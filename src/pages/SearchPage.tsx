import React, { useState, useRef, useCallback } from "react";
import { useStore } from "../store/useStore";
import { searchProjects } from "../lib/tauri";

const EXT_ICON: Record<string, string> = {
  ts:"🔷",tsx:"⚛️",js:"🟡",jsx:"⚛️",rs:"🦀",py:"🐍",go:"🐹",cs:"🟣",
  md:"📝",json:"📋",toml:"⚙️",yaml:"⚙️",yml:"⚙️",env:"🔑",
  html:"🌐",css:"🎨",sh:"💻",
};
const getIcon = (fname: string) => {
  const ext = fname.split(".").pop()?.toLowerCase() ?? "";
  return EXT_ICON[ext] ?? "📄";
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(232,184,75,0.3)", color: "var(--yellow)", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const SearchPage: React.FC = () => {
  const { settings, searchResults, setSearchResults, searchLoading, setSearchLoading, setSelectedProject, setActivePage } = useStore();
  const [query, setQuery]           = useState("");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((q: string) => {
    if (!settings?.projects_path || !q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    searchProjects(settings.projects_path, q, 300)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [settings?.projects_path]);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  // Group by project
  const grouped = searchResults.reduce<Record<string, typeof searchResults>>((acc, r) => {
    (acc[r.project_name] = acc[r.project_name] ?? []).push(r);
    return acc;
  }, {});

  const goToProject = (path: string) => {
    setSelectedProject(path);
    setActivePage("dashboard");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <div className="page-title">Search All Projects</div>
        <div className="page-subtitle">Full-text search across source files, docs, config</div>
      </div>

      {/* Search bar */}
      <div style={{ padding: "0 28px 16px" }}>
        <div className="sidebar-search-wrap" style={{ maxWidth: 600 }}>
          <span className="sidebar-search-icon" style={{ left: 12 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
          <input
            className="sidebar-search"
            style={{ fontSize: 14, padding: "10px 14px 10px 36px", width: "100%" }}
            placeholder="Search for anything across all your projects…"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            autoFocus
          />
          {searchLoading && (
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
              <div className="spinner" />
            </span>
          )}
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--text3)" }}>
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} in {Object.keys(grouped).length} project{Object.keys(grouped).length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 20px" }}>
        {!query && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">Type to search</div>
            <div className="empty-state-desc">Searches .ts, .rs, .py, .md, .json, .env and more</div>
          </div>
        )}

        {query && !searchLoading && searchResults.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">😶</div>
            <div className="empty-state-title">No results</div>
            <div className="empty-state-desc">Nothing matched "{query}"</div>
          </div>
        )}

        {Object.entries(grouped).map(([projectName, results]) => (
          <div key={projectName} style={{ marginBottom: 20 }}>
            {/* Project header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <button
                onClick={() => goToProject(results[0].project_path)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--blue)" }}>{projectName}</span>
              </button>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{results.length} match{results.length !== 1 ? "es" : ""}</span>
            </div>

            {/* File groups within project */}
            {Object.entries(
              results.reduce<Record<string, typeof results>>((acc, r) => {
                (acc[r.file_name] = acc[r.file_name] ?? []).push(r);
                return acc;
              }, {})
            ).map(([fileName, fileResults]) => (
              <div key={fileName} style={{ marginBottom: 10 }}>
                <button
                  style={{
                    display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
                    cursor: "pointer", padding: "4px 0", marginBottom: 4,
                  }}
                  onClick={() => setActiveFile(activeFile === `${projectName}/${fileName}` ? null : `${projectName}/${fileName}`)}
                >
                  <span style={{ fontSize: 12 }}>{getIcon(fileName)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text2)" }}>{fileName}</span>
                  <span style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                    ({fileResults.length})
                  </span>
                </button>

                {/* Match lines */}
                <div style={{
                  background: "var(--bg2)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", overflow: "hidden",
                }}>
                  {fileResults.slice(0, 10).map((r) => (
                    <div key={`${r.file_path}-${r.line_number}`}
                      style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text3)", width: 36, flexShrink: 0, textAlign: "right", paddingTop: 1 }}>
                        {r.line_number}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text2)", flex: 1, overflowX: "auto", whiteSpace: "pre" }}>
                        {highlight(r.line_content, query)}
                      </span>
                    </div>
                  ))}
                  {fileResults.length > 10 && (
                    <div style={{ padding: "5px 12px", fontSize: 11, color: "var(--text3)", textAlign: "center" }}>
                      +{fileResults.length - 10} more matches in this file
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;
