use anyhow::{anyhow, Context};
use gcp_auth::TokenProvider;
use serde_json::{json, Value};

pub struct VertexClient {
    sa: gcp_auth::CustomServiceAccount,
    project: String,
    region: String,
    http: reqwest::Client,
}

impl VertexClient {
    /// Reads env vars in priority order:
    ///   GCP_SERVICE_ACCOUNT_JSON || GOOGLE_SERVICE_ACCOUNT_JSON  (required, full SA JSON)
    ///   GCP_PROJECT_ID || GOOGLE_CLOUD_PROJECT_ID || sa.project_id from JSON
    ///   GCP_REGION (default "global")
    /// Returns None if SA env var is missing/empty/parse-fails (caller logs warning and skips).
    pub fn from_env() -> Option<Self> {
        let sa_json = std::env::var("GCP_SERVICE_ACCOUNT_JSON")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                std::env::var("GOOGLE_SERVICE_ACCOUNT_JSON")
                    .ok()
                    .filter(|s| !s.is_empty())
            })?;

        let sa = gcp_auth::CustomServiceAccount::from_json(&sa_json)
            .map_err(|e| {
                log::warn!("cortex-extract: failed to parse SA JSON: {}", e);
                e
            })
            .ok()?;

        let project = std::env::var("GCP_PROJECT_ID")
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| {
                std::env::var("GOOGLE_CLOUD_PROJECT_ID")
                    .ok()
                    .filter(|s| !s.is_empty())
            })
            .or_else(|| sa.project_id().map(|s| s.to_string()))
            .unwrap_or_else(|| "admachina-atomic-test-84".to_string());

        let region = std::env::var("GCP_REGION")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "global".to_string());

        let http = reqwest::Client::new();

        Some(Self {
            sa,
            project,
            region,
            http,
        })
    }

    /// POST to Vertex with forced tool_use for structured output.
    /// Returns the tool_use.input field from the response.
    pub async fn extract_structured(
        &self,
        model: &str,
        system: &str,
        user: &str,
        tool_name: &str,
        tool_description: &str,
        input_schema: Value,
        max_tokens: u32,
    ) -> anyhow::Result<Value> {
        let url = build_url(&self.region, &self.project, model);

        // Mint auth token
        let scopes = &["https://www.googleapis.com/auth/cloud-platform"];
        let token = self
            .sa
            .token(scopes)
            .await
            .context("Failed to mint GCP token")?;

        let body = json!({
            "anthropic_version": "vertex-2023-10-16",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "tools": [{
                "name": tool_name,
                "description": tool_description,
                "input_schema": input_schema
            }],
            "tool_choice": {"type": "tool", "name": tool_name}
        });

        log::debug!("cortex-extract: POST {}", url);

        let resp = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", token.as_str()))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("HTTP request to Vertex failed")?;

        let status = resp.status();
        let resp_text = resp.text().await.context("Failed to read Vertex response body")?;

        if !status.is_success() {
            return Err(anyhow!(
                "Vertex API returned HTTP {}: {}",
                status,
                resp_text
            ));
        }

        let resp_json: Value =
            serde_json::from_str(&resp_text).context("Failed to parse Vertex response JSON")?;

        // Walk content[] and find the entry with type == "tool_use"
        if let Some(content) = resp_json.get("content").and_then(|c| c.as_array()) {
            for item in content {
                if item.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                    if let Some(input) = item.get("input") {
                        return Ok(input.clone());
                    }
                }
            }
        }

        Err(anyhow!(
            "No tool_use found in Vertex response: {}",
            resp_text
        ))
    }
}

fn build_url(region: &str, project: &str, model: &str) -> String {
    let host = if region == "global" {
        "aiplatform.googleapis.com".to_string()
    } else {
        format!("{}-aiplatform.googleapis.com", region)
    };
    format!(
        "https://{}/v1/projects/{}/locations/{}/publishers/anthropic/models/{}:rawPredict",
        host, project, region, model
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_url_global() {
        let url = build_url("global", "my-project", "claude-haiku-4-5@20251001");
        assert_eq!(
            url,
            "https://aiplatform.googleapis.com/v1/projects/my-project/locations/global/publishers/anthropic/models/claude-haiku-4-5@20251001:rawPredict"
        );
    }

    #[test]
    fn test_build_url_regional() {
        let url = build_url("us-east5", "my-project", "claude-haiku-4-5@20251001");
        assert_eq!(
            url,
            "https://us-east5-aiplatform.googleapis.com/v1/projects/my-project/locations/us-east5/publishers/anthropic/models/claude-haiku-4-5@20251001:rawPredict"
        );
    }

    #[test]
    fn test_from_env_returns_none_without_sa() {
        // Ensure SA env var is not set; from_env should return None gracefully.
        // We temporarily ensure the var is absent for this test.
        let orig = std::env::var("GCP_SERVICE_ACCOUNT_JSON").ok();
        let orig2 = std::env::var("GOOGLE_SERVICE_ACCOUNT_JSON").ok();
        unsafe {
            std::env::remove_var("GCP_SERVICE_ACCOUNT_JSON");
            std::env::remove_var("GOOGLE_SERVICE_ACCOUNT_JSON");
        }
        let result = VertexClient::from_env();
        // Restore
        if let Some(v) = orig {
            unsafe { std::env::set_var("GCP_SERVICE_ACCOUNT_JSON", v); }
        }
        if let Some(v) = orig2 {
            unsafe { std::env::set_var("GOOGLE_SERVICE_ACCOUNT_JSON", v); }
        }
        assert!(result.is_none(), "from_env() must return None when SA env var is absent");
    }
}
