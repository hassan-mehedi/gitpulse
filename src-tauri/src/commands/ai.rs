use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

use crate::error::GitError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCommitRequest {
    provider: String,
    api_key: String,
    base_url: String,
    model: String,
    prompt: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCommitResponse {
    text: String,
}

#[tauri::command]
pub async fn ai_generate_commit_message(
    request: AiCommitRequest,
) -> Result<AiCommitResponse, GitError> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|error| GitError::Io(error.to_string()))?;
    let text = match request.provider.as_str() {
        "ollama" => generate_ollama(&client, &request).await?,
        "anthropic" => generate_anthropic(&client, &request).await?,
        "openai" | "openai-compatible" => generate_openai_compatible(&client, &request).await?,
        provider => {
            return Err(GitError::Parse(format!(
                "unsupported AI provider: {provider}"
            )))
        }
    };
    Ok(AiCommitResponse { text })
}

async fn generate_ollama(
    client: &reqwest::Client,
    request: &AiCommitRequest,
) -> Result<String, GitError> {
    let url = format!("{}/api/chat", trim_slash(&request.base_url));
    let payload = send_json(client.post(url).json(&json!({
        "model": request.model,
        "stream": false,
        "think": false,
        "format": {
            "type": "object",
            "properties": {
                "subject": { "type": "string" },
                "body": { "type": "string" }
            },
            "required": ["subject", "body"],
            "additionalProperties": false
        },
        "options": {
            "temperature": 0.2,
            "num_predict": 220
        },
        "messages": [{ "role": "user", "content": request.prompt }]
    })))
    .await?;
    let text = payload["message"]["content"]
        .as_str()
        .unwrap_or_default()
        .trim()
        .to_string();
    if text.is_empty() {
        let had_thinking = payload["message"]["thinking"]
            .as_str()
            .map(|thinking| !thinking.trim().is_empty())
            .unwrap_or(false);
        let message = if had_thinking {
            "Ollama returned reasoning but no final commit message. Try a non-thinking model or a smaller diff."
        } else {
            "Ollama returned an empty commit message response. Try a smaller diff or model."
        };
        return Err(GitError::Parse(message.to_string()));
    }
    Ok(text)
}

async fn generate_openai_compatible(
    client: &reqwest::Client,
    request: &AiCommitRequest,
) -> Result<String, GitError> {
    let base_url = if request.provider == "openai" {
        "https://api.openai.com/v1"
    } else {
        trim_slash(&request.base_url)
    };
    let payload = send_json(
        client
            .post(format!("{base_url}/responses"))
            .bearer_auth(&request.api_key)
            .json(&json!({
                "model": request.model,
                "input": request.prompt
            })),
    )
    .await?;
    if let Some(text) = payload["output_text"].as_str() {
        return Ok(text.to_string());
    }
    let mut text = String::new();
    if let Some(output) = payload["output"].as_array() {
        for item in output {
            if let Some(content) = item["content"].as_array() {
                for part in content {
                    if let Some(part_text) = part["text"].as_str() {
                        text.push_str(part_text);
                    }
                }
            }
        }
    }
    Ok(text)
}

async fn generate_anthropic(
    client: &reqwest::Client,
    request: &AiCommitRequest,
) -> Result<String, GitError> {
    let payload = send_json(
        client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &request.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": request.model,
                "max_tokens": 300,
                "messages": [{ "role": "user", "content": request.prompt }]
            })),
    )
    .await?;
    let mut text = String::new();
    if let Some(content) = payload["content"].as_array() {
        for part in content {
            if part["type"].as_str() == Some("text") {
                text.push_str(part["text"].as_str().unwrap_or_default());
            }
        }
    }
    Ok(text)
}

async fn send_json(builder: reqwest::RequestBuilder) -> Result<Value, GitError> {
    let response = builder.send().await.map_err(|error| {
        if error.is_timeout() {
            GitError::Io("AI provider request timed out after 90 seconds".to_string())
        } else if error.is_connect() {
            GitError::Io(format!("Could not connect to AI provider: {error}"))
        } else {
            GitError::Io(error.to_string())
        }
    })?;
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| GitError::Parse(error.to_string()))?;
    if !status.is_success() {
        let message = payload["error"]["message"]
            .as_str()
            .unwrap_or("AI provider request failed");
        return Err(GitError::Parse(format!("{message} ({status})")));
    }
    Ok(payload)
}

fn trim_slash(value: &str) -> &str {
    value.trim().trim_end_matches('/')
}
