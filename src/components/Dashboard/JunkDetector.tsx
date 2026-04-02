import React, { useState, useMemo } from "react";
import { useStore } from "../../store/useStore";
import { detectJunk, deleteJunkItems } from "../../lib/tauri";

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
  if (bytes < 1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
}

const CATEGORY_COLOR: Record<string, string> = {
  Dependencies: "var(--blue)",
  Build:        "var(--orange)",
  Cache:        "var(--yellow)",
  Logs:         "var(--purple)",
  Venv:         "var(--green)",
  Coverage:     "var(--red)",
  Native:       "var(--text2)",
  Temp:         "var(--text3)",
  OS:           "var(--text3)",
};

const JunkDetector: React.FC = () => {
  const { settings, junkItems, setJunkItems, junkLoading, setJunkLoading, setShowJunkModal } = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ freed: number; errors: string[] } | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const handleScan = async () => {
    if (!settings?.projects_path) return;
    setJunkLoading(true);
    setSelected(new Set());
    setDeleteResult(null);
    try {
      const items = await detectJunk(settings.projects_path);
      setJunkItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setJunkLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = ["All", ...Array.from(new Set(junkItems.map((i) => i.category)))];
    return cats;
  }, [junkItems]);

  const filtered = useMemo(() => (
    activeCategory === "All" ? junkItems : junkItems.filter((i) => i.category === activeCategory)
  ), [junkItems, activeCategory]);

  const totalSelected = useMemo(() => (
    Array.from(selected).reduce((acc, p) => {
      const item = junkItems.find((i) => i.path === p);
      return acc + (item?.size_bytes ?? 0);
    }, 0)
  ), [selected, junkItems]);

  const totalAll = useMemo(() => junkItems.reduce((a, i) => a + i.size_bytes, 0), [junkItems]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.path)));
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const result = await deleteJunkItems(Array.from(selected));
      setDeleteResult({ freed: result.freed_bytes, errors: result.errors });
      setJunkItems(junkItems.filter((i) => !selected.has(i.path)));
      setSelected(new Set());
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setShowJunkModal(false)}>
      <div className="modal" style={{ width: 680, maxWidth: "92vw", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="modal-title" style={{ marginBottom: 0 }}>🗑️ Junk File Detector</div>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowJunkModal(false)}>✕ Close</button>
        </div>

        {deleteResult && (
          <div style={{ background: "rgba(92,186,125,0.1)", border: "1px solid rgba(92,186,125,0.2)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, color: "var(--green)", marginBottom: 12 }}>
            ✓ Freed {fmt(deleteResult.freed)}
            {deleteResult.errors.length > 0 && ` · ${deleteResult.errors.length} errors`}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Junk</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)" }}>{fmt(totalAll)}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{junkItems.length} items</div>
          </div>
          <div style={{ flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Selected</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>{fmt(totalSelected)}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{selected.size} items</div>
          </div>
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
          {categories.map((c) => (
            <button key={c} className={`docs-tab-btn ${activeCategory === c ? "active" : ""}`}
              style={{ padding: "4px 10px" }} onClick={() => setActiveCategory(c)}>
              {c}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg2)" }}>
          {junkItems.length === 0 && !junkLoading && (
            <div className="docs-empty">
              <div style={{ fontSize: 24 }}>🧹</div>
              <div style={{ color: "var(--text3)", fontSize: 12 }}>
                {junkItems.length === 0 ? "Click Scan to detect junk files" : "No junk found!"}
              </div>
            </div>
          )}
          {junkLoading && (
            <div className="loading-state" style={{ height: 120 }}>
              <div className="spinner" /><span>Scanning for junk files…</span>
            </div>
          )}
          {!junkLoading && filtered.length > 0 && (
            <table className="deps-table">
              <thead>
                <tr>
                  <th style={{ width: 32 }}>
                    <input type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: "pointer" }} />
                  </th>
                  <th>Path</th>
                  <th>Project</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Size</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.path}>
                    <td>
                      <input type="checkbox"
                        checked={selected.has(item.path)}
                        onChange={() => {
                          const s = new Set(selected);
                          s.has(item.path) ? s.delete(item.path) : s.add(item.path);
                          setSelected(s);
                        }}
                        style={{ cursor: "pointer" }} />
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={item.path}>
                      {item.is_dir ? "📁" : "📄"} {item.name}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text3)" }}>{item.project}</td>
                    <td>
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: `${CATEGORY_COLOR[item.category] ?? "var(--text3)"}18`, color: CATEGORY_COLOR[item.category] ?? "var(--text3)", fontWeight: 600 }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: item.size_bytes > 100*1024*1024 ? "var(--red)" : "var(--text2)" }}>
                      {fmt(item.size_bytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={handleScan} disabled={junkLoading}>
            {junkLoading ? "Scanning…" : "🔍 Scan"}
          </button>
          <button
            className="btn"
            style={{ background: selected.size > 0 ? "rgba(224,92,92,0.15)" : "var(--bg3)", border: `1px solid ${selected.size > 0 ? "rgba(224,92,92,0.3)" : "var(--border)"}`, color: selected.size > 0 ? "var(--red)" : "var(--text3)", fontWeight: 600 }}
            disabled={selected.size === 0 || deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : `🗑️ Delete Selected (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JunkDetector;
