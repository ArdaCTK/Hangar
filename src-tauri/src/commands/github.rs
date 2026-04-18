use crate::models::{GitCommit, GitHubData, GitHubIssue, GitHubLabel, GitHubComment};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use std::time::Duration;

fn build_client(token: &str) -> Result<reqwest::Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/vnd.github+json"));
    headers.insert(USER_AGENT, HeaderValue::from_static("project-dashboard/0.2"));
    headers.insert("X-GitHub-Api-Version", HeaderValue::from_static("2022-11-28"));
    if !token.is_empty() {
        let auth = format!("Bearer {}", token);
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&auth).map_err(|e| e.to_string())?);
    }
    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(8))
        .build().map_err(|e| e.to_string())
}

async fn fetch_readme_content(client: &reqwest::Client, owner: &str, repo: &str, default_branch: &str) -> Option<String> {
    let branches = [default_branch, "main", "master", "develop"];
    for branch in &branches {
        let url = format!("https://raw.githubusercontent.com/{}/{}/{}/README.md", owner, repo, branch);
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(text) = resp.text().await {
                    return Some(text);
                }
            }
        }
    }
    None
}

#[tauri::command]
pub async fn fetch_github(owner: String, repo: String, token: String) -> Result<GitHubData, String> {
    let client = build_client(&token)?;
    let base = format!("https://api.github.com/repos/{}/{}", owner, repo);

    let repo_resp: serde_json::Value = client.get(&base).send().await
        .map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;

    if let Some(msg) = repo_resp.get("message").and_then(|m| m.as_str()) {
        return Err(format!("GitHub API: {}", msg));
    }

    let commits_resp: serde_json::Value = client.get(format!("{}/commits?per_page=30", base))
        .send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;

    let commits: Vec<GitCommit> = commits_resp.as_array().unwrap_or(&vec![]).iter().map(|c| {
        let hash = c["sha"].as_str().unwrap_or("").to_string();
        let short_hash = hash.chars().take(7).collect();
        let message = c["commit"]["message"].as_str().unwrap_or("").lines().next().unwrap_or("").to_string();
        let author = c["commit"]["author"]["name"].as_str().unwrap_or("").to_string();
        let date = c["commit"]["author"]["date"].as_str().unwrap_or("").to_string();
        GitCommit { hash, short_hash, message, author, date }
    }).collect();

    let branches_resp: serde_json::Value = client.get(format!("{}/branches?per_page=50", base))
        .send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let branches: Vec<String> = branches_resp.as_array().unwrap_or(&vec![])
        .iter().filter_map(|b| b["name"].as_str().map(|s| s.to_string())).collect();

    let prs_resp: serde_json::Value = client.get(format!("{}/pulls?state=open&per_page=1", base))
        .send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let open_prs = prs_resp.as_array().map(|a| a.len()).unwrap_or(0) as u64;

    let topics_resp: serde_json::Value = client.get(format!("{}/topics", base))
        .send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let topics: Vec<String> = topics_resp["names"].as_array().unwrap_or(&vec![])
        .iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect();

    let default_branch = repo_resp["default_branch"].as_str().unwrap_or("main").to_string();
    let is_private = repo_resp["private"].as_bool().unwrap_or(false);

    // Fetch README
    let readme = if !is_private || !token.is_empty() {
        fetch_readme_content(&client, &owner, &repo, &default_branch).await
    } else {
        None
    };

    Ok(GitHubData {
        stars:       repo_resp["stargazers_count"].as_u64().unwrap_or(0),
        forks:       repo_resp["forks_count"].as_u64().unwrap_or(0),
        open_issues: repo_resp["open_issues_count"].as_u64().unwrap_or(0),
        open_prs,
        description: repo_resp["description"].as_str().map(|s| s.to_string()),
        homepage:    repo_resp["homepage"].as_str().filter(|s| !s.is_empty()).map(|s| s.to_string()),
        topics, commits, branches, default_branch,
        created_at:  repo_resp["created_at"].as_str().unwrap_or("").to_string(),
        updated_at:  repo_resp["updated_at"].as_str().unwrap_or("").to_string(),
        size_kb:     repo_resp["size"].as_u64().unwrap_or(0),
        watchers:    repo_resp["watchers_count"].as_u64().unwrap_or(0),
        license_name: repo_resp["license"]["name"].as_str().map(|s| s.to_string()),
        private: is_private,
        readme,
    })
}

#[tauri::command]
pub async fn fetch_github_user_repos(token: String) -> Result<Vec<GithubRepoSummary>, String> {
    if token.is_empty() { return Err("GitHub token required".to_string()); }
    let client = build_client(&token)?;
    let mut all: Vec<GithubRepoSummary> = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!("https://api.github.com/user/repos?per_page=100&page={}&affiliation=owner&sort=updated", page);
        let resp: serde_json::Value = client.get(&url).send().await
            .map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
        let arr = match resp.as_array() {
            Some(a) if !a.is_empty() => a.clone(),
            _ => break,
        };
        for r in &arr {
            all.push(GithubRepoSummary {
                name:           r["name"].as_str().unwrap_or("").to_string(),
                full_name:      r["full_name"].as_str().unwrap_or("").to_string(),
                clone_url:      r["clone_url"].as_str().unwrap_or("").to_string(),
                html_url:       r["html_url"].as_str().unwrap_or("").to_string(),
                description:    r["description"].as_str().map(|s| s.to_string()),
                private:        r["private"].as_bool().unwrap_or(false),
                stars:          r["stargazers_count"].as_u64().unwrap_or(0),
                updated_at:     r["updated_at"].as_str().unwrap_or("").to_string(),
                default_branch: r["default_branch"].as_str().unwrap_or("main").to_string(),
                language:       r["language"].as_str().map(|s| s.to_string()),
                owner:          r["owner"]["login"].as_str().unwrap_or("").to_string(),
            });
        }
        if arr.len() < 100 { break; }
        page += 1;
        if page > 3 { break; }  // limit to 300 repos max for perf
    }
    Ok(all)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GithubRepoSummary {
    pub name: String,
    pub full_name: String,
    pub clone_url: String,
    pub html_url: String,
    pub description: Option<String>,
    pub private: bool,
    pub stars: u64,
    pub updated_at: String,
    pub default_branch: String,
    pub language: Option<String>,
    pub owner: String,
}

// ── GitHub Hub: Issues & PRs ──────────────────────────────────────────────────

#[tauri::command]
pub async fn fetch_github_issues(owner: String, repo: String, token: String, state: String, page: u32) -> Result<Vec<GitHubIssue>, String> {
    let client = build_client(&token)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/issues?state={}&per_page=30&page={}&sort=updated&direction=desc",
        owner, repo, state, page
    );
    let resp: serde_json::Value = client.get(&url).send().await
        .map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;

    let full_name = format!("{}/{}", owner, repo);
    let arr = resp.as_array().ok_or("Invalid response")?;
    let issues: Vec<GitHubIssue> = arr.iter().map(|i| parse_issue(i, &full_name)).collect();
    Ok(issues)
}

#[tauri::command]
pub async fn fetch_all_repos_issues(token: String, state: String) -> Result<Vec<GitHubIssue>, String> {
    if token.is_empty() { return Err("GitHub token required".to_string()); }
    let client = build_client(&token)?;

    let repos = fetch_owned_repo_full_names(&client).await?;
    let mut all_issues: Vec<GitHubIssue> = Vec::new();

    for full_name in repos {
        let url = format!(
            "https://api.github.com/repos/{}/issues?state={}&per_page=20&sort=updated&direction=desc",
            full_name, state
        );
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(val) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = val.as_array() {
                    for issue in arr {
                        all_issues.push(parse_issue(issue, &full_name));
                    }
                }
            }
        }
    }

    // Sort by updated_at desc
    all_issues.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(all_issues)
}

async fn fetch_owned_repo_full_names(client: &reqwest::Client) -> Result<Vec<String>, String> {
    let mut repos = Vec::new();
    let mut page = 1u32;

    loop {
        let url = format!(
            "https://api.github.com/user/repos?per_page=100&page={}&affiliation=owner&sort=updated",
            page
        );
        let resp: serde_json::Value = client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let arr = match resp.as_array() {
            Some(a) if !a.is_empty() => a,
            _ => break,
        };

        for repo in arr {
            if let Some(full_name) = repo.get("full_name").and_then(|v| v.as_str()) {
                repos.push(full_name.to_string());
            }
        }

        if arr.len() < 100 {
            break;
        }
        page += 1;
    }

    Ok(repos)
}

#[tauri::command]
pub async fn fetch_github_comments(owner: String, repo: String, issue_number: u64, token: String) -> Result<Vec<GitHubComment>, String> {
    let client = build_client(&token)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/issues/{}/comments?per_page=50",
        owner, repo, issue_number
    );
    let resp: serde_json::Value = client.get(&url).send().await
        .map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;

    let arr = resp.as_array().ok_or("Invalid response")?;
    let comments: Vec<GitHubComment> = arr.iter().map(|c| {
        GitHubComment {
            id: c["id"].as_u64().unwrap_or(0),
            body: c["body"].as_str().unwrap_or("").to_string(),
            user_login: c["user"]["login"].as_str().unwrap_or("").to_string(),
            user_avatar: c["user"]["avatar_url"].as_str().unwrap_or("").to_string(),
            created_at: c["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: c["updated_at"].as_str().unwrap_or("").to_string(),
        }
    }).collect();
    Ok(comments)
}

#[tauri::command]
pub async fn post_github_comment(owner: String, repo: String, issue_number: u64, body: String, token: String) -> Result<GitHubComment, String> {
    if token.is_empty() { return Err("Token required to post comments".to_string()); }
    let client = build_client(&token)?;
    let url = format!(
        "https://api.github.com/repos/{}/{}/issues/{}/comments",
        owner, repo, issue_number
    );
    let payload = serde_json::json!({ "body": body });
    let resp: serde_json::Value = client.post(&url).json(&payload).send().await
        .map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    Ok(GitHubComment {
        id: resp["id"].as_u64().unwrap_or(0),
        body: resp["body"].as_str().unwrap_or("").to_string(),
        user_login: resp["user"]["login"].as_str().unwrap_or("").to_string(),
        user_avatar: resp["user"]["avatar_url"].as_str().unwrap_or("").to_string(),
        created_at: resp["created_at"].as_str().unwrap_or("").to_string(),
        updated_at: resp["updated_at"].as_str().unwrap_or("").to_string(),
    })
}

fn parse_issue(i: &serde_json::Value, repo_full_name: &str) -> GitHubIssue {
    let labels: Vec<GitHubLabel> = i["labels"].as_array().unwrap_or(&vec![]).iter().map(|l| {
        GitHubLabel {
            name: l["name"].as_str().unwrap_or("").to_string(),
            color: l["color"].as_str().unwrap_or("cccccc").to_string(),
        }
    }).collect();

    GitHubIssue {
        id: i["id"].as_u64().unwrap_or(0),
        number: i["number"].as_u64().unwrap_or(0),
        title: i["title"].as_str().unwrap_or("").to_string(),
        state: i["state"].as_str().unwrap_or("").to_string(),
        body: i["body"].as_str().map(|s| s.to_string()),
        user_login: i["user"]["login"].as_str().unwrap_or("").to_string(),
        user_avatar: i["user"]["avatar_url"].as_str().unwrap_or("").to_string(),
        labels,
        comments_count: i["comments"].as_u64().unwrap_or(0),
        created_at: i["created_at"].as_str().unwrap_or("").to_string(),
        updated_at: i["updated_at"].as_str().unwrap_or("").to_string(),
        is_pull_request: i.get("pull_request").is_some(),
        repo_full_name: repo_full_name.to_string(),
        html_url: i["html_url"].as_str().unwrap_or("").to_string(),
    }
}
