import { create } from "zustand";
import type {
  ProjectInfo, ProjectDetails, GitHubData, Settings,
  ActivityDay, SearchResult, JunkItem, PortInfo, ProjectNote,
  VaultProject, Monitor, PingRecord, GitHubIssue, GitHubComment,
  WeeklyReport, MonthlyReport,
} from "../types";

export type SortMode = "recent" | "az" | "za" | "size" | "files";
export type ActivePage = "dashboard" | "search" | "vaultkeeper" | "meridian" | "pingboard" | "github-hub";

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
  activePage: ActivePage;
  setActivePage: (p: ActivePage) => void;

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

  // ── Vaultkeeper ──
  vaultProjects: VaultProject[];
  setVaultProjects: (p: VaultProject[]) => void;
  vaultLoading: boolean; setVaultLoading: (b: boolean) => void;

  // ── PingBoard ──
  monitors: Monitor[];
  setMonitors: (m: Monitor[]) => void;
  pingHistory: Record<string, PingRecord[]>;
  setPingHistory: (id: string, records: PingRecord[]) => void;
  pingLoading: boolean; setPingLoading: (b: boolean) => void;

  // ── Meridian ──
  weeklyReport: WeeklyReport | null;
  setWeeklyReport: (r: WeeklyReport | null) => void;
  monthlyReport: MonthlyReport | null;
  setMonthlyReport: (r: MonthlyReport | null) => void;
  meridianLoading: boolean; setMeridianLoading: (b: boolean) => void;

  // ── GitHub Hub ──
  ghIssues: GitHubIssue[];
  setGhIssues: (issues: GitHubIssue[]) => void;
  ghIssueComments: Record<string, GitHubComment[]>;
  setGhIssueComments: (key: string, comments: GitHubComment[]) => void;
  ghHubLoading: boolean; setGhHubLoading: (b: boolean) => void;
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

  // ── Vaultkeeper ──
  vaultProjects: [], setVaultProjects: (vaultProjects) => set({ vaultProjects }),
  vaultLoading: false, setVaultLoading: (vaultLoading) => set({ vaultLoading }),

  // ── PingBoard ──
  monitors: [], setMonitors: (monitors) => set({ monitors }),
  pingHistory: {},
  setPingHistory: (id, records) => set((s) => ({ pingHistory: { ...s.pingHistory, [id]: records } })),
  pingLoading: false, setPingLoading: (pingLoading) => set({ pingLoading }),

  // ── Meridian ──
  weeklyReport: null, setWeeklyReport: (weeklyReport) => set({ weeklyReport }),
  monthlyReport: null, setMonthlyReport: (monthlyReport) => set({ monthlyReport }),
  meridianLoading: false, setMeridianLoading: (meridianLoading) => set({ meridianLoading }),

  // ── GitHub Hub ──
  ghIssues: [], setGhIssues: (ghIssues) => set({ ghIssues }),
  ghIssueComments: {},
  setGhIssueComments: (key, comments) => set((s) => ({ ghIssueComments: { ...s.ghIssueComments, [key]: comments } })),
  ghHubLoading: false, setGhHubLoading: (ghHubLoading) => set({ ghHubLoading }),
}));
