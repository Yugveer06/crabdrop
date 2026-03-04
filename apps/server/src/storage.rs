use aws_credential_types::Credentials;
use aws_sdk_s3::config::Region;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;
use tracing::{debug, error, info};

/// Result from an R2 GetObject call, carrying the stream and metadata.
pub struct GetObjectResult {
    pub body: ByteStream,
    pub content_length: Option<i64>,
    pub content_type: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

pub struct Storage {
    client: Client,
    bucket: String,
    public_url: String,
}

impl Storage {
    pub fn new(
        account_id: &str,
        access_key: &str,
        secret_key: &str,
        bucket: &str,
        public_url: &str,
    ) -> Self {
        let credentials = Credentials::new(access_key, secret_key, None, None, "r2");

        let config = aws_sdk_s3::Config::builder()
            .endpoint_url(format!(
                "https://{}.r2.cloudflarestorage.com",
                account_id
            ))
            .credentials_provider(credentials)
            .region(Region::new("auto"))
            .behavior_version_latest()
            .force_path_style(true)
            .build();

        let client = Client::from_conf(config);

        Self {
            client,
            bucket: bucket.to_string(),
            public_url: public_url.to_string(),
        }
    }

    pub async fn upload(
        &self,
        key: &str,
        body: Vec<u8>,
        content_type: &str,
    ) -> Result<String, String> {
        let size = body.len();
        debug!(key = %key, size, content_type = %content_type, "Uploading to R2");

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(body))
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| {
                error!(key = %key, "R2 upload failed: {}", e);
                format!("R2 upload failed: {}", e)
            })?;

        let url = format!("{}/{}", self.public_url, key);
        info!(key = %key, size, "R2 upload successful");
        Ok(url)
    }

    pub async fn delete(&self, key: &str) -> Result<(), String> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| format!("R2 delete failed: {}", e))?;

        Ok(())
    }

    /// Fetch an object from R2 and return its byte-stream + metadata.
    /// The body is NOT buffered — it streams directly from R2.
    pub async fn get(&self, key: &str) -> Result<GetObjectResult, String> {
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| format!("R2 get failed: {}", e))?;

        Ok(GetObjectResult {
            body: resp.body,
            content_length: resp.content_length,
            content_type: resp.content_type,
            etag: resp.e_tag,
            last_modified: resp.last_modified.map(|t| t.to_string()),
        })
    }
}
