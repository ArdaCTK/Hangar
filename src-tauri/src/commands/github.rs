use crate::models::{GitCommit, GitHubData};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};

fn build_client(token: &str) -> Result<reqwest::Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
    headers.insert(USER_AGENT, HeaderValue::from_static("project-dashboard/0.1"));
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static("2022-11-28"),
    );
    if !token.is_empty() {
        let auth = format!("Bearer {}", token);
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&auth).map_err(|e| e.to_string())?,
        );
    }

    reqwest::Client::builder()
        .default_headers(headers)
        .build()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_github(
    owner: String,
    repo: String,
    token: String,
) -> Result<GitHubData, String> {
    let client = build_client(&token)?;
    let base = format!("https://api.github.com/repos/{}/{}", owner, repo);

    // Fetch repo info
    let repo_resp: serde_json::Value = client
        .get(&base)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(msg) = repo_resp.get("message").and_then(|m| m.as_str()) {
        return Err(format!("GitHub API: {}", msg));
    }

    // Fetch commits (up to 30)
    let commits_resp: serde_json::Value = client
        .get(format!("{}/commits?per_page=30", base))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let commits: Vec<GitCommit> = commits_resp
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|c| {
            let hash = c["sha"].as_str().unwrap_or("").to_string();
            let short_hash = hash.chars().take(7).collect();
            let message = c["commit"]["message"]
                .as_str()
                .unwrap_or("")
                .lines()
                .next()
                .unwrap_or("")
                .to_string();
            let author = c["commit"]["author"]["name"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let date = c["commit"]["author"]["date"]
                .as_str()
                .unwrap_or("")
                .to_string();
            GitCommit { hash, short_hash, message, author, date }
        })
        .collect();

    // Fetch branches
    let branches_resp: serde_json::Value = client
        .get(format!("{}/branches?per_page=50", base))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let branches: Vec<String> = branches_resp
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|b| b["name"].as_str().map(|s| s.to_string()))
        .collect();

    // Fetch open PRs count
    let prs_resp: serde_json::Value = client
        .get(format!("{}/pulls?state=open&per_page=1", base))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    // Use the Link header count if available; otherwise use array len as lower bound
    let open_prs = prs_resp.as_array().map(|a| a.len()).unwrap_or(0) as u64;

    // Fetch topics
    let topics_resp: serde_json::Value = client
        .get(format!("{}/topics", base))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let topics: Vec<String> = topics_resp["names"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|t| t.as_str().map(|s| s.to_string()))
        .collect();

    let default_branch = repo_resp["default_branch"]
        .as_str()
        .unwrap_or("main")
        .to_string();

    Ok(GitHubData {
        stars:          repo_resp["stargazers_count"].as_u64().unwrap_or(0),
        forks:          repo_resp["forks_count"].as_u64().unwrap_or(0),
        open_issues:    repo_resp["open_issues_count"].as_u64().unwrap_or(0),
        open_prs,
        description:    repo_resp["description"].as_str().map(|s| s.to_string()),
        homepage:       repo_resp["homepage"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()),
        topics,
        commits,
        branches,
        default_branch,
        created_at:     repo_resp["created_at"].as_str().unwrap_or("").to_string(),
        updated_at:     repo_resp["updated_at"].as_str().unwrap_or("").to_string(),
        size_kb:        repo_resp["size"].as_u64().unwrap_or(0),
        watchers:       repo_resp["watchers_count"].as_u64().unwrap_or(0),
        license_name:   repo_resp["license"]["name"].as_str().map(|s| s.to_string()),
    })
}
