use serde::{Deserialize, Serialize};

// ── Project Core ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub has_git: bool,
    pub remote_url: Option<String>,
    pub github_owner: Option<String>,
    pub github_repo: Option<String>,
    pub languages: Vec<String>,
    pub frameworks: Vec<String>,
    pub project_type: String,
    pub last_modified: i64,
    pub file_count: u64,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub name: String,
    pub version: String,
    pub dep_type: String,
    pub ecosystem: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocs {
    pub readme: Option<String>,
    pub license: Option<String>,
    pub contributing: Option<String>,
    pub code_of_conduct: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConnection {
    pub key: String,
    pub hint: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDetails {
    pub info: ProjectInfo,
    pub git_branches: Vec<String>,
    pub git_log: Vec<GitCommit>,
    pub git_current_branch: Option<String>,
    pub dependencies: Vec<Dependency>,
    pub docs: ProjectDocs,
    pub api_connections: Vec<ApiConnection>,
}

// ── GitHub ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubData {
    pub stars: u64,
    pub forks: u64,
    pub open_issues: u64,
    pub open_prs: u64,
    pub description: Option<String>,
    pub homepage: Option<String>,
    pub topics: Vec<String>,
    pub commits: Vec<GitCommit>,
    pub branches: Vec<String>,
    pub default_branch: String,
    pub created_at: String,
    pub updated_at: String,
    pub size_kb: u64,
    pub watchers: u64,
    pub license_name: Option<String>,
}

// ── File Tree ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub extension: Option<String>,
    pub children: Vec<FileNode>,
}

// ── Settings ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub projects_path: String,
    pub github_token: Option<String>,
}
