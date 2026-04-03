use serde::{Deserialize, Serialize};

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
    pub dep_count: u32,
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
    pub private: bool,
    pub readme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub extension: Option<String>,
    pub children: Vec<FileNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub projects_path: String,
    pub github_token: Option<String>,
}

// ── Notes & Tags ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectNote {
    pub note: String,
    pub tags: Vec<String>,
    pub updated_at: i64,
}

// ── Search ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub project_name: String,
    pub project_path: String,
    pub file_name: String,
    pub file_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub context_before: String,
    pub context_after: String,
}

// ── Junk Detection ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JunkItem {
    pub path: String,
    pub name: String,
    pub project: String,
    pub category: String,
    pub size_bytes: u64,
    pub is_dir: bool,
}

// ── Port Scanner ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    pub port: u16,
    pub open: bool,
    pub likely_project: Option<String>,
    pub service_hint: String,
}

// ── Activity ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityDay {
    pub date: String,    // "2024-03-15"
    pub count: u32,
    pub projects: Vec<String>,
}

// ── Vaultkeeper ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultSecret {
    pub key: String,
    pub value: String,
    pub category: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultProject {
    pub project_path: String,
    pub project_name: String,
    pub secrets: Vec<VaultSecret>,
}

// ── PingBoard ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Monitor {
    pub id: String,
    pub name: String,
    pub url: String,
    pub method: String,
    pub interval_seconds: u32,
    pub is_active: bool,
    pub last_status: String,
    pub last_response_ms: Option<u32>,
    pub last_checked_at: Option<i64>,
    pub uptime_24h: f64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingRecord {
    pub timestamp: i64,
    pub status: String,
    pub response_ms: u32,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

// ── Meridian (Time Tracker) ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEntry {
    pub project_name: String,
    pub project_path: String,
    pub date: String,
    pub duration_minutes: u32,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTimeSummary {
    pub name: String,
    pub hours: f64,
    pub percentage: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyTime {
    pub date: String,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyTime {
    pub week: String,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyReport {
    pub week_start: String,
    pub total_hours: f64,
    pub projects: Vec<ProjectTimeSummary>,
    pub daily: Vec<DailyTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyReport {
    pub month: String,
    pub total_hours: f64,
    pub projects: Vec<ProjectTimeSummary>,
    pub weekly: Vec<WeeklyTime>,
}

// ── GitHub Hub ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub state: String,
    pub body: Option<String>,
    pub user_login: String,
    pub user_avatar: String,
    pub labels: Vec<GitHubLabel>,
    pub comments_count: u64,
    pub created_at: String,
    pub updated_at: String,
    pub is_pull_request: bool,
    pub repo_full_name: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubLabel {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubComment {
    pub id: u64,
    pub body: String,
    pub user_login: String,
    pub user_avatar: String,
    pub created_at: String,
    pub updated_at: String,
}

