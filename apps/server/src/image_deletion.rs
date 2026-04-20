use sea_orm::EntityTrait;
use tracing::info;

use crate::entities::images;
use crate::state::SharedState;

pub async fn delete_image(state: &SharedState, file: images::Model) -> Result<(), String> {
    state.storage.delete(&file.r2_key).await?;

    images::Entity::delete_by_id(file.id)
        .exec(&state.db)
        .await
        .map_err(|e| format!("Database delete failed: {}", e))?;

    info!(
        id = %file.id,
        slug = %file.slug,
        r2_key = %file.r2_key,
        "Deleted image from storage and database"
    );

    Ok(())
}
