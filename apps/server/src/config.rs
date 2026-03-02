use std::env;

pub struct Config {
    pub database_url: String,
    pub r2_account_id: String,
    pub r2_access_key_id: String,
    pub r2_secret_access_key: String,
    pub r2_bucket_name: String,
    pub r2_public_url: String,
    pub max_upload_bytes: usize,
}

impl Config {
    pub fn from_env() -> Self {
        let max_upload_mb: usize = env::var("MAX_UPLOAD_MB")
            .unwrap_or_else(|_| "50".to_string())
            .parse()
            .expect("MAX_UPLOAD_MB must be a number");

        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            r2_account_id: env::var("R2_ACCOUNT_ID").expect("R2_ACCOUNT_ID must be set"),
            r2_access_key_id: env::var("R2_ACCESS_KEY_ID").expect("R2_ACCESS_KEY_ID must be set"),
            r2_secret_access_key: env::var("R2_SECRET_ACCESS_KEY")
                .expect("R2_SECRET_ACCESS_KEY must be set"),
            r2_bucket_name: env::var("R2_BUCKET_NAME").expect("R2_BUCKET_NAME must be set"),
            r2_public_url: env::var("R2_PUBLIC_URL")
                .expect("R2_PUBLIC_URL must be set")
                .trim_end_matches('/')
                .to_string(),
            max_upload_bytes: max_upload_mb * 1024 * 1024,
        }
    }
}
