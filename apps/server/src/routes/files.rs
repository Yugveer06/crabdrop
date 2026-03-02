use axum::extract::{Path, State};
use axum::http::header;
use axum::response::{IntoResponse, Response};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

use crate::entities::images;
use crate::error::AppError;
use crate::state::SharedState;

pub async fn get_file(
    State(state): State<SharedState>,
    Path(slug_with_ext): Path<String>,
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

    let bytes = state
        .storage
        .get(&file.r2_key)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok((
        [
            (header::CONTENT_TYPE, file.content_type.as_str()),
            (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
        ],
        bytes,
    )
        .into_response())
}
