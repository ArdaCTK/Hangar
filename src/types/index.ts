// ── Project Core ──────────────────────────────────────────────────────────────

export interface ProjectInfo {
  name: string; path: string; has_git: boolean;
  remote_url: string | null; github_owner: string | null; github_repo: string | null;
  languages: string[]; frameworks: string[]; project_type: string;
  last_modified: number; file_count: number; total_size: number; dep_count: number;
}

export interface GitCommit {
  hash: string; short_hash: string; message: string; author: string; date: string;
}

export interface Dependency {
  name: string; version: string; dep_type: string; ecosystem: string;
}

export interface ProjectDocs {
  readme: string | null; license: string | null;
  contributing: string | null; code_of_conduct: string | null;
}

export interface ApiConnection { key: string; hint: string; source: string; }

export interface ProjectDetails {
  info: ProjectInfo; git_branches: string[]; git_log: GitCommit[];
  git_current_branch: string | null; dependencies: Dependency[];
  docs: ProjectDocs; api_connections: ApiConnection[];
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export interface GitHubData {
  stars: number; forks: number; open_issues: number; open_prs: number;
  description: string | null; homepage: string | null; topics: string[];
  commits: GitCommit[]; branches: string[]; default_branch: string;
  created_at: string; updated_at: string; size_kb: number; watchers: number;
  license_name: string | null; private: boolean; readme: string | null;
}

export interface GithubRepoSummary {
  name: string; full_name: string; clone_url: string; html_url: string;
  description: string | null; private: boolean; stars: number;
  updated_at: string; default_branch: string; language: string | null; owner: string;
}

// ── File Tree ─────────────────────────────────────────────────────────────────

export interface FileNode {
  name: string; path: string; is_dir: boolean; size: number;
  extension: string | null; children: FileNode[];
}

// ── Settings & Notes ──────────────────────────────────────────────────────────

export interface Settings { projects_path: string; github_token: string | null; }

export interface ProjectNote { note: string; tags: string[]; updated_at: number; }

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  total_projects: number; git_connected: number; git_unconnected: number;
  total_files: number; total_dependencies: number; total_api_connections: number;
  total_size_bytes: number; language_distribution: LanguageStat[];
  framework_distribution: LanguageStat[]; project_type_distribution: LanguageStat[];
}

export interface LanguageStat { name: string; count: number; percentage: number; }

// ── Activity ──────────────────────────────────────────────────────────────────

export interface ActivityDay { date: string; count: number; projects: string[]; }

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  project_name: string; project_path: string; file_name: string; file_path: string;
  line_number: number; line_content: string; context_before: string; context_after: string;
}

// ── Junk ──────────────────────────────────────────────────────────────────────

export interface JunkItem {
  path: string; name: string; project: string;
  category: string; size_bytes: number; is_dir: boolean;
}

export interface DeleteResult { freed_bytes: number; errors: string[]; }

// ── Port Scanner ──────────────────────────────────────────────────────────────

export interface PortInfo {
  port: number; open: boolean; likely_project: string | null; service_hint: string;
}

// ── Terminal / Scripts ────────────────────────────────────────────────────────

export interface ScriptInfo {
  name: string; command: string; program: string;
  args: string[]; ecosystem: string; hint: string;
}

// ── Vaultkeeper ───────────────────────────────────────────────────────────────

export interface VaultSecret {
  key: string;
  value: string;
  category: 'env' | 'api_key' | 'ssh_key' | 'token' | 'custom';
  created_at: number;
  updated_at: number;
}

export interface VaultProject {
  project_path: string;
  project_name: string;
  secrets: VaultSecret[];
}

// ── Meridian (Time Tracker) ───────────────────────────────────────────────────

export interface TimeEntry {
  project_name: string;
  project_path: string;
  date: string;
  duration_minutes: number;
  source: 'git_commits';
}

export interface WeeklyReport {
  week_start: string;
  total_hours: number;
  projects: { name: string; hours: number; percentage: number }[];
  daily: { date: string; hours: number }[];
}

export interface MonthlyReport {
  month: string;
  total_hours: number;
  projects: { name: string; hours: number; percentage: number }[];
  weekly: { week: string; hours: number }[];
}

// ── PingBoard ─────────────────────────────────────────────────────────────────

export interface Monitor {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  interval_seconds: number;
  is_active: boolean;
  last_status: 'up' | 'down' | 'degraded' | 'unknown';
  last_response_ms: number | null;
  last_checked_at: number | null;
  uptime_24h: number;
  created_at: number;
}

export interface PingRecord {
  timestamp: number;
  status: 'up' | 'down' | 'degraded';
  response_ms: number;
  status_code: number | null;
  error: string | null;
}

// ── GitHub Hub ────────────────────────────────────────────────────────────────

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  body: string | null;
  user_login: string;
  user_avatar: string;
  labels: GitHubLabel[];
  comments_count: number;
  created_at: string;
  updated_at: string;
  is_pull_request: boolean;
  repo_full_name: string;
  html_url: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user_login: string;
  user_avatar: string;
  created_at: string;
  updated_at: string;
}
