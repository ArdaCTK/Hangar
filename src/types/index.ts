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
