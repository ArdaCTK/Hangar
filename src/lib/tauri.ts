import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ProjectInfo, ProjectDetails, GitHubData, GithubRepoSummary,
  FileNode, Settings, DashboardStats, ActivityDay, SearchResult,
  JunkItem, DeleteResult, PortInfo, ScriptInfo, ProjectNote, LanguageStat,
  VaultProject, VaultSecret, Monitor, PingRecord,
  WeeklyReport, MonthlyReport, GitHubIssue, GitHubComment,
} from "../types";

// ── Settings ──────────────────────────────────────────────────────────────────
export const loadSettings = (): Promise<Settings> => invoke("load_settings");
export const saveSettings = (s: Settings): Promise<void> => invoke("save_settings", { settings: s });
export const selectFolder = async (): Promise<string | null> => {
  const r = await open({ directory: true, multiple: false });
  return typeof r === "string" ? r : null;
};

// ── Notes ─────────────────────────────────────────────────────────────────────
export const loadNotes = (): Promise<Record<string, ProjectNote>> => invoke("load_notes");
export const saveNote = (projectPath: string, note: string, tags: string[]): Promise<void> =>
  invoke("save_note", { projectPath, note, tags });
export const deleteNote = (projectPath: string): Promise<void> =>
  invoke("delete_note", { projectPath });

// ── Scanning ──────────────────────────────────────────────────────────────────
export const scanProjects = (path: string): Promise<ProjectInfo[]> => invoke("scan_projects", { path });
export const getProjectDetails = (path: string): Promise<ProjectDetails> => invoke("get_project_details", { path });

// ── Stats ─────────────────────────────────────────────────────────────────────
export const getDashboardStats = (projects: ProjectInfo[], totalDeps = 0): DashboardStats => {
  const lang_map: Record<string, number> = {};
  const fw_map: Record<string, number> = {};
  const type_map: Record<string, number> = {};
  let total_files = 0, total_size = 0, git_connected = 0, total_dep_count = 0;
  for (const p of projects) {
    if (p.has_git) git_connected++;
    total_files += p.file_count;
    total_size += p.total_size;
    total_dep_count += (p.dep_count ?? 0);
    for (const l of p.languages) lang_map[l] = (lang_map[l] ?? 0) + 1;
    for (const f of p.frameworks) fw_map[f] = (fw_map[f] ?? 0) + 1;
    type_map[p.project_type] = (type_map[p.project_type] ?? 0) + 1;
  }
  const toStat = (m: Record<string, number>): LanguageStat[] => {
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    return Object.entries(m).sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count, percentage: total > 0 ? Math.round(count / total * 100) : 0 }));
  };
  return {
    total_projects: projects.length, git_connected, git_unconnected: projects.length - git_connected,
    total_files, total_dependencies: Math.max(total_dep_count, totalDeps), total_api_connections: 0, total_size_bytes: total_size,
    language_distribution: toStat(lang_map), framework_distribution: toStat(fw_map),
    project_type_distribution: toStat(type_map),
  };
};

// ── GitHub ────────────────────────────────────────────────────────────────────
export const fetchGitHub = (owner: string, repo: string, token: string | null): Promise<GitHubData> =>
  invoke("fetch_github", { owner, repo, token: token ?? "" });
export const fetchGitHubUserRepos = (token: string): Promise<GithubRepoSummary[]> =>
  invoke("fetch_github_user_repos", { token });

// ── Files ─────────────────────────────────────────────────────────────────────
export const getFileTree = (path: string): Promise<FileNode[]> => invoke("get_file_tree", { path });
export const readProjectFile = (path: string): Promise<string> => invoke("read_project_file", { path });
export const openInExplorer = (path: string): Promise<void> => invoke("open_in_explorer", { path });
export const openInVscode = (path: string): Promise<void> => invoke("open_in_vscode", { path });
export const gitCheckout = (path: string, branch: string): Promise<void> =>
  invoke("git_checkout", { path, branch });

// ── Terminal & Scripts ────────────────────────────────────────────────────────
export const terminalRun = (id: string, path: string, program: string, args: string[]): Promise<void> =>
  invoke("terminal_run", { id, path, program, args });
export const terminalKill = (id: string): Promise<void> => invoke("terminal_kill", { id });
export const getProjectScripts = (path: string): Promise<ScriptInfo[]> =>
  invoke("get_project_scripts", { path });

// ── Search ────────────────────────────────────────────────────────────────────
export const searchProjects = (projectsPath: string, query: string, maxResults = 200): Promise<SearchResult[]> =>
  invoke("search_projects", { projectsPath, query, maxResults });

// ── Junk ──────────────────────────────────────────────────────────────────────
export const detectJunk = (projectsPath: string): Promise<JunkItem[]> => invoke("detect_junk", { projectsPath });
export const deleteJunkItems = (paths: string[]): Promise<DeleteResult> => invoke("delete_junk_items", { paths });

// ── Ports ─────────────────────────────────────────────────────────────────────
export const scanPorts = (): Promise<PortInfo[]> => invoke("scan_ports");

// ── Activity ──────────────────────────────────────────────────────────────────
export const getActivityData = (projectPaths: string[]): Promise<ActivityDay[]> =>
  invoke("get_activity_data", { projectPaths });

// ── Git log for branch ────────────────────────────────────────────────────────
export const getGitLogForBranch = (path: string, branch: string, limit = 50): Promise<import("../types").GitCommit[]> =>
  invoke("get_git_log_for_branch", { path, branch, limit });

// ── Vaultkeeper ─────────────────────────────────────────────────────────────
export const vaultGetAll = (): Promise<VaultProject[]> => invoke("vault_get_all");
export const vaultAddSecret = (projectPath: string, key: string, value: string, category: string): Promise<void> =>
  invoke("vault_add_secret", { projectPath, key, value, category });
export const vaultDeleteSecret = (projectPath: string, key: string): Promise<void> =>
  invoke("vault_delete_secret", { projectPath, key });
export const vaultExportEnv = (projectPath: string): Promise<string> =>
  invoke("vault_export_env", { projectPath });
export const vaultImportEnv = (projectPath: string, envContent: string): Promise<number> =>
  invoke("vault_import_env", { projectPath, envContent });
export const vaultScanProjectEnv = (projectPath: string): Promise<VaultSecret[]> =>
  invoke("vault_scan_project_env", { projectPath });

// ── PingBoard ──────────────────────────────────────────────────────────────
export const pingAddMonitor = (name: string, url: string, intervalSeconds: number, method: string): Promise<Monitor> =>
  invoke("ping_add_monitor", { name, url, intervalSeconds, method });
export const pingRemoveMonitor = (id: string): Promise<void> => invoke("ping_remove_monitor", { id });
export const pingGetAllMonitors = (): Promise<Monitor[]> => invoke("ping_get_all_monitors");
export const pingCheckNow = (id: string): Promise<Monitor> => invoke("ping_check_now", { id });
export const pingGetHistory = (id: string): Promise<PingRecord[]> => invoke("ping_get_history", { id });
export const pingUpdateMonitor = (id: string, name: string, url: string, intervalSeconds: number, method: string, isActive: boolean): Promise<void> =>
  invoke("ping_update_monitor", { id, name, url, intervalSeconds, method, isActive });

// ── Meridian (Time Tracker) ────────────────────────────────────────────────
export const timeGetWeeklyReport = (projectPaths: string[]): Promise<WeeklyReport> =>
  invoke("time_get_weekly_report", { projectPaths });
export const timeGetMonthlyReport = (projectPaths: string[], year: number, month: number): Promise<MonthlyReport> =>
  invoke("time_get_monthly_report", { projectPaths, year, month });
export const timeExportCsv = (projectPaths: string[], startDate: string, endDate: string, hourlyRate: number): Promise<string> =>
  invoke("time_export_csv", { projectPaths, startDate, endDate, hourlyRate });

// ── GitHub Hub ─────────────────────────────────────────────────────────────
export const fetchGitHubIssues = (owner: string, repo: string, token: string, state: string, page: number): Promise<GitHubIssue[]> =>
  invoke("fetch_github_issues", { owner, repo, token, state, page });
export const fetchAllReposIssues = (token: string, state: string): Promise<GitHubIssue[]> =>
  invoke("fetch_all_repos_issues", { token, state });
export const fetchGitHubComments = (owner: string, repo: string, issueNumber: number, token: string): Promise<GitHubComment[]> =>
  invoke("fetch_github_comments", { owner, repo, issueNumber, token });
export const postGitHubComment = (owner: string, repo: string, issueNumber: number, body: string, token: string): Promise<GitHubComment> =>
  invoke("post_github_comment", { owner, repo, issueNumber, body, token });
