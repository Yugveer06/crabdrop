use axum::extract::{Multipart, State};
use axum::Json;
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::Serialize;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::entities::images;
use crate::error::AppError;
use crate::state::SharedState;

const ALLOWED_CONTENT_TYPES: &[&str] = &[
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
    "image/bmp",
    "image/tiff",
    // Video
    "video/mp4",
    "video/webm",
    "video/quicktime",
    // Audio
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/flac",
];

fn extension_from_content_type(ct: &str) -> &str {
    match ct {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        "image/avif" => "avif",
        "image/bmp" => "bmp",
        "image/tiff" => "tiff",
        "video/mp4" => "mp4",
        "video/webm" => "webm",
        "video/quicktime" => "mov",
        "audio/mpeg" => "mp3",
        "audio/ogg" => "ogg",
        "audio/wav" => "wav",
        "audio/webm" => "weba",
        "audio/flac" => "flac",
        _ => "bin",
    }
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub id: Uuid,
    pub slug: String,
    pub url: String,
    pub original_filename: String,
    pub content_type: String,
    pub size_bytes: i64,
}

pub async fn upload(
    State(state): State<SharedState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid multipart data: {}", e)))?
        .ok_or_else(|| AppError::BadRequest("No file provided".to_string()))?;

    let original_filename = field
        .file_name()
        .unwrap_or("unknown")
        .to_string();

    let content_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    if !ALLOWED_CONTENT_TYPES.contains(&content_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "File type '{}' is not allowed. Allowed types: images, video, and audio.",
            content_type
        )));
    }

    let bytes = field
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read file: {}", e)))?;

    if bytes.is_empty() {
        return Err(AppError::BadRequest("File is empty".to_string()));
    }

    if bytes.len() > state.max_upload_bytes {
        return Err(AppError::BadRequest(format!(
            "File too large. Max size: {} MB",
            state.max_upload_bytes / 1024 / 1024
        )));
    }

    // Hash the file for deduplication
    let hash = format!("{:x}", Sha256::digest(&bytes));

    // Check if this exact file was already uploaded
    let existing = images::Entity::find()
        .filter(images::Column::Hash.eq(&hash))
        .one(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?;

    if let Some(existing) = existing {
        return Ok(Json(UploadResponse {
            id: existing.id,
            slug: existing.slug.clone(),
            url: format!("{}/{}", state.r2_public_url, existing.r2_key),
            original_filename: existing.original_filename,
            content_type: existing.content_type,
            size_bytes: existing.size_bytes,
        }));
    }

    // Generate a unique slug and R2 key
    let slug = nanoid::nanoid!(8);
    let extension = extension_from_content_type(&content_type);
    let r2_key = format!("{}.{}", slug, extension);

    // Upload to R2
    let url = state
        .storage
        .upload(&r2_key, bytes.to_vec(), &content_type)
        .await
        .map_err(|e| AppError::Internal(e))?;

    // Save to database
    let now = Utc::now().fixed_offset();
    let id = Uuid::new_v4();

    let record = images::ActiveModel {
        id: Set(id),
        slug: Set(slug.clone()),
        original_filename: Set(original_filename.clone()),
        content_type: Set(content_type.clone()),
        size_bytes: Set(bytes.len() as i64),
        r2_key: Set(r2_key),
        hash: Set(hash),
        expires_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    record
        .insert(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to save record: {}", e)))?;

    Ok(Json(UploadResponse {
        id,
        slug,
        url,
        original_filename,
        content_type,
        size_bytes: bytes.len() as i64,
    }))
}
