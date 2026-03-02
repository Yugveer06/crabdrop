use sea_orm::DatabaseConnection;
use std::sync::Arc;
use dashmap::DashMap;
use tokio::sync::mpsc;

use crate::compression::ProgressEvent;
use crate::storage::Storage;

pub struct AppState {
    pub db: DatabaseConnection,
    pub storage: Storage,
    pub max_upload_bytes: usize,
    pub r2_public_url: String,
    /// Active compression job channels keyed by job_id.
    pub jobs: DashMap<String, mpsc::Sender<ProgressEvent>>,
}

pub type SharedState = Arc<AppState>;
