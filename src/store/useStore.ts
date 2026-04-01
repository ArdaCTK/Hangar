import { create } from "zustand";
import type { ProjectInfo, ProjectDetails, GitHubData, Settings } from "../types";

interface AppStore {
  // Settings
  settings: Settings | null;
  setSettings: (s: Settings) => void;

  // Projects list
  projects: ProjectInfo[];
  setProjects: (p: ProjectInfo[]) => void;
  isScanning: boolean;
  setIsScanning: (b: boolean) => void;
  scanError: string | null;
  setScanError: (e: string | null) => void;

  // Selected project
  selectedProject: string | null;
  setSelectedProject: (path: string | null) => void;

  // Details cache: path → details
  detailsCache: Record<string, ProjectDetails>;
  setDetails: (path: string, d: ProjectDetails) => void;
  loadingDetails: Record<string, boolean>;
  setLoadingDetails: (path: string, b: boolean) => void;

  // GitHub cache: "owner/repo" → data
  githubCache: Record<string, GitHubData>;
  setGitHub: (key: string, d: GitHubData) => void;
  loadingGitHub: Record<string, boolean>;
  setLoadingGitHub: (key: string, b: boolean) => void;

  // Sidebar search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const useStore = create<AppStore>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),

  projects: [],
  setProjects: (projects) => set({ projects }),
  isScanning: false,
  setIsScanning: (isScanning) => set({ isScanning }),
  scanError: null,
  setScanError: (scanError) => set({ scanError }),

  selectedProject: null,
  setSelectedProject: (selectedProject) => set({ selectedProject }),

  detailsCache: {},
  setDetails: (path, details) =>
    set((s) => ({ detailsCache: { ...s.detailsCache, [path]: details } })),
  loadingDetails: {},
  setLoadingDetails: (path, b) =>
    set((s) => ({ loadingDetails: { ...s.loadingDetails, [path]: b } })),

  githubCache: {},
  setGitHub: (key, data) =>
    set((s) => ({ githubCache: { ...s.githubCache, [key]: data } })),
  loadingGitHub: {},
  setLoadingGitHub: (key, b) =>
    set((s) => ({ loadingGitHub: { ...s.loadingGitHub, [key]: b } })),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
