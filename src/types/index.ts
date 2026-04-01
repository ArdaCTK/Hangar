// ── Project Core ─────────────────────────────────────────────────────────────

export interface ProjectInfo {
  name: string;
  path: string;
  has_git: boolean;
  remote_url: string | null;
  github_owner: string | null;
  github_repo: string | null;
  languages: string[];
  frameworks: string[];
  project_type: string;
  last_modified: number;
  file_count: number;
  total_size: number;
}

export interface GitCommit {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
}

export interface Dependency {
  name: string;
  version: string;
  dep_type: string;
  ecosystem: string;
}

export interface ProjectDocs {
  readme: string | null;
  license: string | null;
  contributing: string | null;
  code_of_conduct: string | null;
}

export interface ApiConnection {
  key: string;
  hint: string;
  source: string;
}

export interface ProjectDetails {
  info: ProjectInfo;
  git_branches: string[];
  git_log: GitCommit[];
  git_current_branch: string | null;
  dependencies: Dependency[];
  docs: ProjectDocs;
  api_connections: ApiConnection[];
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export interface GitHubData {
  stars: number;
  forks: number;
  open_issues: number;
  open_prs: number;
  description: string | null;
  homepage: string | null;
  topics: string[];
  commits: GitCommit[];
  branches: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  size_kb: number;
  watchers: number;
  license_name: string | null;
}

// ── File Tree ─────────────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension: string | null;
  children: FileNode[];
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Settings {
  projects_path: string;
  github_token: string | null;
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  total_projects: number;
  git_connected: number;
  git_unconnected: number;
  total_files: number;
  total_dependencies: number;
  total_api_connections: number;
  total_size_bytes: number;
  language_distribution: LanguageStat[];
  framework_distribution: LanguageStat[];
  project_type_distribution: LanguageStat[];
}

export interface LanguageStat {
  name: string;
  count: number;
  percentage: number;
}
