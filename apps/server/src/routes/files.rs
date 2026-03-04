use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

use crate::entities::images;
use crate::error::AppError;
use crate::state::SharedState;

pub async fn get_file(
    State(state): State<SharedState>,
    Path(slug_with_ext): Path<String>,
    request_headers: HeaderMap,
) -> Result<Response, AppError> {
    let slug = slug_with_ext
        .split('.')
        .next()
        .unwrap_or(&slug_with_ext);

    let file = images::Entity::find()
        .filter(images::Column::Slug.eq(slug))
        .one(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?
        .ok_or_else(|| AppError::NotFound("File not found".to_string()))?;

    if let Some(expires_at) = &file.expires_at {
        if *expires_at < chrono::Utc::now().fixed_offset() {
            return Err(AppError::NotFound("File has expired".to_string()));
        }
    }

    // Fetch the object stream + metadata from R2
    let obj = state
        .storage
        .get(&file.r2_key)
        .await
        .map_err(|e| AppError::Internal(e))?;

    // --- Conditional request support (ETag / If-None-Match) ---
    if let Some(etag) = &obj.etag {
        if let Some(if_none_match) = request_headers
            .get(header::IF_NONE_MATCH)
            .and_then(|v| v.to_str().ok())
        {
            if if_none_match == etag.as_str() {
                return Ok(StatusCode::NOT_MODIFIED.into_response());
            }
        }
    }

    // Build the response headers
    let content_type = obj
        .content_type
        .unwrap_or_else(|| file.content_type.clone());

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=31536000, immutable".parse().unwrap(),
    );

    if let Some(len) = obj.content_length {
        headers.insert(header::CONTENT_LENGTH, len.into());
    }
    if let Some(etag) = &obj.etag {
        if let Ok(val) = etag.parse() {
            headers.insert(header::ETAG, val);
        }
    }
    if let Some(last_mod) = &obj.last_modified {
        if let Ok(val) = last_mod.parse() {
            headers.insert(header::LAST_MODIFIED, val);
        }
    }

    // Collect the R2 ByteStream into bytes.
    // ByteStream does not implement tokio_stream::Stream (required by Body::from_stream),
    // so we aggregate the bytes and build the body from them.
    let data = obj
        .body
        .collect()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read R2 body: {}", e)))?
        .into_bytes();

    let body = Body::from(data);

    Ok((headers, body).into_response())
}
