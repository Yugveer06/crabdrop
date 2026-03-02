use axum::extract::DefaultBodyLimit;
use axum::routing::{get, post};
use axum::Router;
use dashmap::DashMap;
use sea_orm::Database;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

mod compression;
mod config;
mod entities;
mod error;
mod routes;
mod state;
mod storage;

use config::Config;
use state::AppState;
use storage::Storage;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let config = Config::from_env();

    let db = Database::connect(&config.database_url)
        .await
        .expect("Failed to connect to database");
    println!("Connected to database");

    let storage = Storage::new(
        &config.r2_account_id,
        &config.r2_access_key_id,
        &config.r2_secret_access_key,
        &config.r2_bucket_name,
        &config.r2_public_url,
    );
    println!("R2 storage client initialized");

    let state = Arc::new(AppState {
        db,
        storage,
        max_upload_bytes: config.max_upload_bytes,
        r2_public_url: config.r2_public_url,
        jobs: DashMap::new(),
    });

    let app = Router::new()
        .route("/api/health", get(routes::health::health))
        .route("/api/upload", post(routes::upload::upload))
        .route("/api/progress", get(routes::progress::progress))
        .route("/f/{slug_with_ext}", get(routes::files::get_file))
        .layer(DefaultBodyLimit::max(config.max_upload_bytes))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001")
        .await
        .unwrap();

    println!("Crabdrop backend listening on http://localhost:3001");
    axum::serve(listener, app).await.unwrap();
}
