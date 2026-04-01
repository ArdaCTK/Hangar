import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ProjectInfo,
  ProjectDetails,
  GitHubData,
  FileNode,
  Settings,
  DashboardStats,
} from "../types";

// ── Settings ──────────────────────────────────────────────────────────────────

export const loadSettings = (): Promise<Settings> =>
  invoke("load_settings");

export const saveSettings = (settings: Settings): Promise<void> =>
  invoke("save_settings", { settings });

export const selectFolder = async (): Promise<string | null> => {
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
};

// ── Scanning ──────────────────────────────────────────────────────────────────

export const scanProjects = (path: string): Promise<ProjectInfo[]> =>
  invoke("scan_projects", { path });

export const getDashboardStats = (projects: ProjectInfo[]): DashboardStats => {
  const lang_map: Record<string, number> = {};
  const fw_map: Record<string, number> = {};
  const type_map: Record<string, number> = {};

  let total_files = 0;
  let total_api = 0;
  let total_size = 0;
  let git_connected = 0;

  for (const p of projects) {
    if (p.has_git) git_connected++;
    total_files += p.file_count;
    total_size += p.total_size;

    for (const l of p.languages) {
      lang_map[l] = (lang_map[l] ?? 0) + 1;
    }
    for (const f of p.frameworks) {
      fw_map[f] = (fw_map[f] ?? 0) + 1;
    }
    type_map[p.project_type] = (type_map[p.project_type] ?? 0) + 1;
  }

  const toStat = (map: Record<string, number>): import("../types").LanguageStat[] => {
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
  };

  return {
    total_projects: projects.length,
    git_connected,
    git_unconnected: projects.length - git_connected,
    total_files,
    total_dependencies: 0, // populated from details cache
    total_api_connections: total_api,
    total_size_bytes: total_size,
    language_distribution: toStat(lang_map),
    framework_distribution: toStat(fw_map),
    project_type_distribution: toStat(type_map),
  };
};

// ── Project Details ───────────────────────────────────────────────────────────

export const getProjectDetails = (path: string): Promise<ProjectDetails> =>
  invoke("get_project_details", { path });

// ── GitHub ────────────────────────────────────────────────────────────────────

export const fetchGitHub = (
  owner: string,
  repo: string,
  token: string | null
): Promise<GitHubData> =>
  invoke("fetch_github", { owner, repo, token: token ?? "" });

// ── Files ─────────────────────────────────────────────────────────────────────

export const getFileTree = (path: string): Promise<FileNode[]> =>
  invoke("get_file_tree", { path });

export const readProjectFile = (path: string): Promise<string> =>
  invoke("read_project_file", { path });

// ── Shell ─────────────────────────────────────────────────────────────────────

export const openInExplorer = (path: string): Promise<void> =>
  invoke("open_in_explorer", { path });
