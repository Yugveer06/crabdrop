use crate::state::SharedState;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use std::time::Duration;
use tracing::{error, info, warn};

pub async fn run_cleanup_job(state: SharedState) {
    info!("Starting database and storage cleanup background job...");

    loop {
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
                    let r2_key = file.r2_key.clone();
                    let id = file.id;
                    let mut backoff_secs = 1;
                    let max_retries = 3;

                    for attempt in 1..=max_retries {
                        info!(id = %id, r2_key = %r2_key, attempt, "Attempting to auto-delete expired file");
                        match crate::image_deletion::delete_image(&state, file.clone()).await {
                            Ok(_) => {
                                info!(id = %id, r2_key = %r2_key, "Successfully deleted expired file from DB and R2");
                                break;
                            }
                            Err(e) => {
                                if attempt == max_retries {
                                    error!(id = %id, r2_key = %r2_key, "Failed to delete expired file after {} attempts: {}", max_retries, e);
                                } else {
                                    warn!(id = %id, r2_key = %r2_key, "Failed to delete expired file (attempt {}), retrying in {}s: {}", attempt, backoff_secs, e);
                                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                                    backoff_secs *= 2;
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to query expired files from database: {}", e);
            }
        }

        tokio::time::sleep(Duration::from_secs(60 * 60)).await;
    }
}
