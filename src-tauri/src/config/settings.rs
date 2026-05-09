use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub auto_fetch: bool,
    pub auto_fetch_interval_seconds: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            auto_fetch: true,
            auto_fetch_interval_seconds: 180,
        }
    }
}
