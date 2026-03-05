use crate::state::SharedState;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use std::time::Duration;
use tracing::{error, info};

pub async fn run_cleanup_job(state: SharedState) {
    info!("Starting database and storage cleanup background job...");

    loop {
        // Run cleanup every hour
        tokio::time::sleep(Duration::from_secs(60 * 60)).await;

        let now = chrono::Utc::now().fixed_offset();

        match crate::entities::images::Entity::find()
            .filter(crate::entities::images::Column::ExpiresAt.lt(now))
            .all(&state.db)
            .await
        {
            Ok(expired_files) => {
                if !expired_files.is_empty() {
                    info!("Found {} expired files to delete", expired_files.len());
                }

                for file in expired_files {
                    // Try to delete from R2 first
                    match state.storage.delete(&file.r2_key).await {
                        Ok(_) => {
                            // If deleted from R2 successfully, delete from DB
                            if let Err(e) = crate::entities::images::Entity::delete_by_id(file.id)
                                .exec(&state.db)
                                .await
                            {
                                error!("Failed to delete expired file {} from DB: {}", file.slug, e);
                            } else {
                                info!("Successfully deleted expired file: {} ({} bytes)", file.original_filename, file.size_bytes);
                            }
                        }
                        Err(e) => {
                            error!("Failed to delete expired file {} from R2: {}", file.slug, e);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to query expired files from database: {}", e);
            }
        }
    }
}
