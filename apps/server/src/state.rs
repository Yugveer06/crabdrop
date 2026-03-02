use sea_orm::DatabaseConnection;
use std::sync::Arc;

use crate::storage::Storage;

pub struct AppState {
    pub db: DatabaseConnection,
    pub storage: Storage,
    pub max_upload_bytes: usize,
    pub r2_public_url: String,
}

pub type SharedState = Arc<AppState>;
