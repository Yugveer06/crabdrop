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
                    match crate::image_deletion::delete_image(&state, file).await {
                        Ok(_) => {
                            info!("Successfully deleted expired file");
                        }
                        Err(e) => {
                            error!("Failed to delete expired file: {}", e);
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
