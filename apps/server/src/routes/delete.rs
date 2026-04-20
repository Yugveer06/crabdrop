use axum::Json;
use axum::extract::{Path, State};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde::Serialize;
use tracing::{info, warn};
use uuid::Uuid;

use crate::entities::images;
use crate::error::AppError;
use crate::state::SharedState;

#[derive(Serialize)]
pub struct DeleteResponse {
    pub id: Uuid,
    pub slug: String,
    pub deleted: bool,
}

pub async fn delete_image(
    State(state): State<SharedState>,
    Path(delete_hash): Path<String>,
) -> Result<Json<DeleteResponse>, AppError> {
    let file = images::Entity::find()
        .filter(images::Column::DeleteHash.eq(&delete_hash))
        .one(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Database error: {}", e)))?
        .ok_or_else(|| {
            warn!("Delete requested with unknown delete hash");
            AppError::NotFound("Image not found for the provided delete hash".to_string())
        })?;

    let id = file.id;
    let slug = file.slug.clone();

    crate::image_deletion::delete_image(&state, file)
        .await
        .map_err(AppError::Internal)?;

    info!(id = %id, slug = %slug, "Deleted image via delete hash");

    Ok(Json(DeleteResponse {
        id,
        slug,
        deleted: true,
    }))
}
