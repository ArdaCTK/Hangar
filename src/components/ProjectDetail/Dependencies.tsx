import React, { useState } from "react";
import type { Dependency } from "../../types";

interface Props {
  dependencies: Dependency[];
}

function getBadgeClass(depType: string): string {
  const t = depType.toLowerCase();
  if (t.includes("dev")) return "devdep";
  if (t.includes("peer")) return "peer";
  if (t === "dependency" || t === "dep") return "dep";
  if (t.includes("cargo") || t.includes("rust")) return "cargo";
  if (t.includes("python") || t.includes("pip")) return "python";
  return "other";
}

const Dependencies: React.FC<Props> = ({ dependencies }) => {
  const [search, setSearch] = useState("");
  const [ecosystem, setEcosystem] = useState("all");

  const ecosystems = ["all", ...Array.from(new Set(dependencies.map((d) => d.ecosystem)))];

  const filtered = dependencies.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchEco = ecosystem === "all" || d.ecosystem === ecosystem;
    return matchSearch && matchEco;
  });

  if (dependencies.length === 0) {
    return (
      <div className="docs-empty">
        <div className="empty-state-icon">📦</div>
        <div className="empty-state-title">No dependencies found</div>
        <div className="empty-state-desc">
          No package.json, Cargo.toml, requirements.txt, or go.mod detected.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
        <div className="sidebar-search-wrap" style={{ flex: 1 }}>
          <span className="sidebar-search-icon">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            className="sidebar-search"
            placeholder="Filter dependencies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          {ecosystems.map((e) => (
            <button
              key={e}
              className={`docs-tab-btn ${ecosystem === e ? "active" : ""}`}
              onClick={() => setEcosystem(e)}
              style={{ padding: "4px 10px", borderBottom: "2px solid transparent" }}
            >
              {e}
            </button>
          ))}
        </div>

        <span style={{ fontSize: "11px", color: "var(--text3)", whiteSpace: "nowrap" }}>
          {filtered.length} / {dependencies.length}
        </span>
      </div>

      <div
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}
      >
        <table className="deps-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Version</th>
              <th>Type</th>
              <th>Ecosystem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={i}>
                <td className="dep-name">{d.name}</td>
                <td className="dep-version">{d.version}</td>
                <td>
                  <span className={`dep-type-badge ${getBadgeClass(d.dep_type)}`}>
                    {d.dep_type}
                  </span>
                </td>
                <td>
                  <span className="ecosystem-badge">{d.ecosystem}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dependencies;
