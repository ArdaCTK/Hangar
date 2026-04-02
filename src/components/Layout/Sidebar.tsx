import React from "react";
import { useStore, type SortMode } from "../../store/useStore";

const LANG_COLORS: Record<string, string> = {
  TypeScript:"#3178c6",JavaScript:"#f7df1e",Rust:"#ce422b",Python:"#3776ab",
  "C#":"#239120",Go:"#00acd7",Kotlin:"#7f52ff",Java:"#ed8b00",Swift:"#fa7343",
  "C++":"#00599c",Vue:"#42b883",Svelte:"#ff3e00",HTML:"#e34f26",CSS:"#1572b6",
};
const getColor = (lang: string) => LANG_COLORS[lang] ?? "#555";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "recent", label: "Recently modified" },
  { value: "az",     label: "A → Z" },
  { value: "za",     label: "Z → A" },
  { value: "size",   label: "Largest first" },
  { value: "files",  label: "Most files" },
];

function sortProjects(projects: ReturnType<typeof useStore>["projects"], mode: SortMode) {
  const arr = [...projects];
  switch (mode) {
    case "az":     return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "za":     return arr.sort((a, b) => b.name.localeCompare(a.name));
    case "size":   return arr.sort((a, b) => b.total_size - a.total_size);
    case "files":  return arr.sort((a, b) => b.file_count - a.file_count);
    default:       return arr.sort((a, b) => b.last_modified - a.last_modified);
  }
}

interface Props {
  onSettingsClick: () => void;
  onDashboardClick: () => void;
  onSearchClick: () => void;
  onJunkClick: () => void;
}

const Sidebar: React.FC<Props> = ({ onSettingsClick, onDashboardClick, onSearchClick, onJunkClick }) => {
  const {
    projects, selectedProject, setSelectedProject,
    sidebarFilter, setSidebarFilter,
    sortMode, setSortMode,
    isScanning, activePage, setActivePage,
    showJunkModal,
  } = useStore();

  const sorted   = sortProjects(projects, sortMode);
  const filtered = sorted.filter((p) => p.name.toLowerCase().includes(sidebarFilter.toLowerCase()));

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">PD</div>
          <span className="sidebar-logo-text">Project Dashboard</span>
        </div>
        <div className="sidebar-search-wrap">
          <span className="sidebar-search-icon">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          <input className="sidebar-search" placeholder="Filter projects…"
            value={sidebarFilter} onChange={(e) => setSidebarFilter(e.target.value)} />
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-nav">
        <button className={`sidebar-nav-btn ${activePage === "dashboard" && !selectedProject ? "active" : ""}`}
          onClick={() => { setSelectedProject(null); setActivePage("dashboard"); onDashboardClick(); }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
          Dashboard
        </button>
        <button className={`sidebar-nav-btn ${activePage === "search" ? "active" : ""}`}
          onClick={() => { setSelectedProject(null); setActivePage("search"); onSearchClick(); }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Search All Projects
        </button>
        <button className="sidebar-nav-btn" onClick={onJunkClick}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Junk Cleaner
        </button>
      </div>

      {/* Sort */}
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          style={{
            width: "100%", background: "var(--bg3)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", color: "var(--text2)", padding: "5px 8px",
            fontSize: 11, fontFamily: "var(--font)", cursor: "pointer", outline: "none",
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="sidebar-section-title">
        Projects {isScanning ? "…" : `(${projects.length})`}
      </div>

      <div className="sidebar-projects">
        {filtered.map((p) => (
          <button key={p.path}
            className={`sidebar-project-item ${selectedProject === p.path ? "active" : ""}`}
            onClick={() => { setSelectedProject(p.path); setActivePage("dashboard"); }}
            title={p.path}>
            <span className="lang-dot" style={{ background: getColor(p.languages[0] ?? "") }} />
            <span className="sidebar-project-name">{p.name}</span>
            {p.has_git && (
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.35, flexShrink: 0 }}>
                <path d="M15.698 7.287 8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.55 1.56l1.773 1.774a1.224 1.224 0 0 1 1.267 2.025 1.226 1.226 0 0 1-2.002-1.334L8.58 5.963v4.353a1.226 1.226 0 1 1-1.008-.036V5.887a1.226 1.226 0 0 1-.666-1.608L5.093 2.466.302 7.258a1.03 1.03 0 0 0 0 1.457l6.986 6.985a1.03 1.03 0 0 0 1.456 0l6.953-6.956a1.029 1.029 0 0 0 0-1.457"/>
              </svg>
            )}
          </button>
        ))}
        {filtered.length === 0 && !isScanning && (
          <div style={{ padding: "20px 10px", color: "var(--text3)", fontSize: 12, textAlign: "center" }}>
            No projects match
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-settings-btn" onClick={onSettingsClick}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11l-1.06-1.06"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Settings
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
