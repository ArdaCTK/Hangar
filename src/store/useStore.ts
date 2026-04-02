import { create } from "zustand";
import type {
  ProjectInfo, ProjectDetails, GitHubData, Settings,
  ActivityDay, SearchResult, JunkItem, PortInfo, ProjectNote,
} from "../types";

export type SortMode = "recent" | "az" | "za" | "size" | "files";

interface AppStore {
  settings: Settings | null;
  setSettings: (s: Settings) => void;

  projects: ProjectInfo[];
  setProjects: (p: ProjectInfo[]) => void;
  isScanning: boolean; setIsScanning: (b: boolean) => void;
  scanError: string | null; setScanError: (e: string | null) => void;

  selectedProject: string | null;
  setSelectedProject: (p: string | null) => void;

  detailsCache: Record<string, ProjectDetails>;
  setDetails: (p: string, d: ProjectDetails) => void;
  loadingDetails: Record<string, boolean>;
  setLoadingDetails: (p: string, b: boolean) => void;

  githubCache: Record<string, GitHubData>;
  setGitHub: (k: string, d: GitHubData) => void;
  loadingGitHub: Record<string, boolean>;
  setLoadingGitHub: (k: string, b: boolean) => void;

  // Sidebar filter + sort
  sidebarFilter: string;
  setSidebarFilter: (q: string) => void;
  sortMode: SortMode;
  setSortMode: (m: SortMode) => void;

  // Activity
  activityData: ActivityDay[];
  setActivityData: (d: ActivityDay[]) => void;
  activityLoading: boolean;
  setActivityLoading: (b: boolean) => void;

  // Search
  searchResults: SearchResult[];
  setSearchResults: (r: SearchResult[]) => void;
  searchLoading: boolean;
  setSearchLoading: (b: boolean) => void;
  activePage: "dashboard" | "search";
  setActivePage: (p: "dashboard" | "search") => void;

  // Junk
  junkItems: JunkItem[];
  setJunkItems: (items: JunkItem[]) => void;
  junkLoading: boolean; setJunkLoading: (b: boolean) => void;
  showJunkModal: boolean; setShowJunkModal: (b: boolean) => void;

  // Ports
  portData: PortInfo[];
  setPortData: (p: PortInfo[]) => void;
  portsLoading: boolean; setPortsLoading: (b: boolean) => void;

  // Notes
  notes: Record<string, ProjectNote>;
  setNotes: (n: Record<string, ProjectNote>) => void;
  setNote: (path: string, note: ProjectNote) => void;
}

export const useStore = create<AppStore>((set) => ({
  settings: null, setSettings: (settings) => set({ settings }),

  projects: [], setProjects: (projects) => set({ projects }),
  isScanning: false, setIsScanning: (isScanning) => set({ isScanning }),
  scanError: null, setScanError: (scanError) => set({ scanError }),

  selectedProject: null, setSelectedProject: (selectedProject) => set({ selectedProject }),

  detailsCache: {},
  setDetails: (p, d) => set((s) => ({ detailsCache: { ...s.detailsCache, [p]: d } })),
  loadingDetails: {},
  setLoadingDetails: (p, b) => set((s) => ({ loadingDetails: { ...s.loadingDetails, [p]: b } })),

  githubCache: {},
  setGitHub: (k, d) => set((s) => ({ githubCache: { ...s.githubCache, [k]: d } })),
  loadingGitHub: {},
  setLoadingGitHub: (k, b) => set((s) => ({ loadingGitHub: { ...s.loadingGitHub, [k]: b } })),

  sidebarFilter: "", setSidebarFilter: (sidebarFilter) => set({ sidebarFilter }),
  sortMode: "recent", setSortMode: (sortMode) => set({ sortMode }),

  activityData: [], setActivityData: (activityData) => set({ activityData }),
  activityLoading: false, setActivityLoading: (activityLoading) => set({ activityLoading }),

  searchResults: [], setSearchResults: (searchResults) => set({ searchResults }),
  searchLoading: false, setSearchLoading: (searchLoading) => set({ searchLoading }),
  activePage: "dashboard", setActivePage: (activePage) => set({ activePage }),

  junkItems: [], setJunkItems: (junkItems) => set({ junkItems }),
  junkLoading: false, setJunkLoading: (junkLoading) => set({ junkLoading }),
  showJunkModal: false, setShowJunkModal: (showJunkModal) => set({ showJunkModal }),

  portData: [], setPortData: (portData) => set({ portData }),
  portsLoading: false, setPortsLoading: (portsLoading) => set({ portsLoading }),

  notes: {}, setNotes: (notes) => set({ notes }),
  setNote: (path, note) => set((s) => ({ notes: { ...s.notes, [path]: note } })),
}));
