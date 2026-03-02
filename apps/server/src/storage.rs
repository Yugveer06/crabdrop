use aws_credential_types::Credentials;
use aws_sdk_s3::config::Region;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;

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
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(body))
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| format!("R2 upload failed: {}", e))?;

        Ok(format!("{}/{}", self.public_url, key))
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

    pub async fn get(&self, key: &str) -> Result<Vec<u8>, String> {
        let resp = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| format!("R2 get failed: {}", e))?;

        let bytes = resp
            .body
            .collect()
            .await
            .map_err(|e| format!("Failed to read R2 response: {}", e))?
            .into_bytes()
            .to_vec();

        Ok(bytes)
    }
}
