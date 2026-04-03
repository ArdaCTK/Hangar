import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import {
  vaultGetAll, vaultAddSecret, vaultDeleteSecret, vaultExportEnv,
  vaultImportEnv, vaultScanProjectEnv, selectFolder,
} from "../lib/tauri";
import type { VaultProject, VaultSecret } from "../types";

const CATEGORIES = [
  { value: "env", label: "ENV", color: "#5b9cf6" },
  { value: "api_key", label: "API Key", color: "#e8b84b" },
  { value: "ssh_key", label: "SSH Key", color: "#5cba7d" },
  { value: "token", label: "Token", color: "#a78bfa" },
  { value: "custom", label: "Custom", color: "#555555" },
];

const VaultkeeperPage: React.FC = () => {
  const { vaultProjects, setVaultProjects, vaultLoading, setVaultLoading, projects } = useStore();

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addKey, setAddKey] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addCategory, setAddCategory] = useState("env");
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [scanning, setScanning] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { loadVault(); }, []);

  const loadVault = async () => {
    setVaultLoading(true);
    try {
      const data = await vaultGetAll();
      setVaultProjects(data);
    } catch { }
    setVaultLoading(false);
  };

  const handleAddSecret = async () => {
    if (!selectedProject || !addKey) return;
    await vaultAddSecret(selectedProject, addKey, addValue, addCategory);
    setAddKey(""); setAddValue(""); setAddCategory("env"); setShowAdd(false);
    loadVault();
  };

  const handleDeleteSecret = async (key: string) => {
    if (!selectedProject) return;
    await vaultDeleteSecret(selectedProject, key);
    loadVault();
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    try {
      const envContent = await vaultExportEnv(selectedProject);
      await navigator.clipboard.writeText(envContent);
      setCopied("export");
      setTimeout(() => setCopied(null), 2000);
    } catch { }
  };

  const handleImport = async () => {
    if (!selectedProject || !importText) return;
    await vaultImportEnv(selectedProject, importText);
    setImportText(""); setShowImport(false);
    loadVault();
  };

  const handleScanProject = async (projectPath: string) => {
    setScanning(true);
    try {
      const secrets = await vaultScanProjectEnv(projectPath);
      for (const s of secrets) {
        await vaultAddSecret(projectPath, s.key, s.value, s.category);
      }
      loadVault();
    } catch { }
    setScanning(false);
  };

  const handleScanAll = async () => {
    setScanning(true);
    for (const p of projects) {
      try {
        const secrets = await vaultScanProjectEnv(p.path);
        for (const s of secrets) {
          await vaultAddSecret(p.path, s.key, s.value, s.category);
        }
      } catch { }
    }
    await loadVault();
    setScanning(false);
  };

  const copyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleShow = (key: string) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const currentProject = vaultProjects.find(p => p.project_path === selectedProject);
  const filteredSecrets = (currentProject?.secrets ?? []).filter(s => {
    if (filter && !s.key.toLowerCase().includes(filter.toLowerCase())) return false;
    if (catFilter !== "all" && s.category !== catFilter) return false;
    return true;
  });

  const totalSecrets = vaultProjects.reduce((acc, p) => acc + p.secrets.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="page-title" style={{ marginBottom: 0 }}>🔑 Vaultkeeper</div>
          <button className="btn btn-ghost" style={{ padding: "4px 12px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, lineHeight: 1 }}
            onClick={handleScanAll} disabled={scanning}>
            <span style={{ fontSize: 12, display: "flex", alignItems: "center", marginTop: -2 }}>{scanning ? "⏳" : "🔍"}</span>
            <span style={{ marginTop: 1 }}>{scanning ? "Scanning…" : "Scan All Projects"}</span>
          </button>
        </div>
        <div className="page-subtitle">
          {vaultProjects.length} projects • {totalSecrets} secrets stored
        </div>
      </div>

      <div className="vault-layout">
        {/* Project List */}
        <div className="vault-sidebar">
          <div className="vault-sidebar-header">
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text3)", letterSpacing: "0.06em" }}>
              Projects
            </div>
          </div>

          {/* List projects from vault */}
          {vaultProjects.map(vp => (
            <button key={vp.project_path}
              className={`vault-project-btn ${selectedProject === vp.project_path ? "active" : ""}`}
              onClick={() => setSelectedProject(vp.project_path)}
              title={vp.project_path}>
              <span className="vault-project-name">{vp.project_name}</span>
              <span className="vault-secret-count">{vp.secrets.length}</span>
            </button>
          ))}

          {/* Add new project from scanned projects */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "8px 0", marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "var(--text3)", letterSpacing: "0.06em", padding: "4px 10px" }}>
              Local Projects
            </div>
            {projects.filter(p => !vaultProjects.some(vp => vp.project_path === p.path)).slice(0, 20).map(p => (
              <button key={p.path} className="vault-project-btn"
                onClick={() => handleScanProject(p.path)}
                title={`Scan ${p.path} for secrets`}>
                <span className="vault-project-name" style={{ color: "var(--text3)" }}>{p.name}</span>
                <span style={{ fontSize: 9, color: "var(--blue)" }}>scan</span>
              </button>
            ))}
          </div>
        </div>

        {/* Secret List */}
        <div className="vault-main">
          {!selectedProject && (
            <div className="empty-state" style={{ height: "100%" }}>
              <div className="empty-state-icon">🔐</div>
              <div className="empty-state-title">Select a project</div>
              <div className="empty-state-desc">Choose a project from the sidebar to view its secrets, or scan all projects to discover .env files.</div>
            </div>
          )}

          {selectedProject && (
            <>
              <div className="vault-toolbar">
                <input className="ghub-search" placeholder="Filter secrets…"
                  value={filter} onChange={e => setFilter(e.target.value)} />
                <select className="ghub-select" value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}>
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <button className="btn btn-ghost" style={{ fontSize: 11 }}
                  onClick={() => setShowImport(!showImport)}>📥 Import .env</button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }}
                  onClick={handleExport}>📤 Export .env {copied === "export" ? "✓" : ""}</button>
                <button className="btn btn-primary" style={{ fontSize: 11 }}
                  onClick={() => setShowAdd(true)}>+ Add Secret</button>
              </div>

              {showImport && (
                <div className="vault-import-area">
                  <textarea className="form-input" style={{ minHeight: 80, fontFamily: "var(--font-mono)", fontSize: 11 }}
                    placeholder="Paste .env content here…&#10;KEY=value&#10;API_KEY=abc123"
                    value={importText} onChange={e => setImportText(e.target.value)} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                    <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleImport}>Import</button>
                  </div>
                </div>
              )}

              {showAdd && (
                <div className="vault-add-row">
                  <input className="form-input" placeholder="KEY_NAME" value={addKey}
                    onChange={e => setAddKey(e.target.value.toUpperCase())}
                    style={{ fontFamily: "var(--font-mono)", flex: 1 }} />
                  <input className="form-input" placeholder="secret value" value={addValue}
                    onChange={e => setAddValue(e.target.value)}
                    style={{ flex: 2 }} type="password" />
                  <select className="form-input" value={addCategory}
                    onChange={e => setAddCategory(e.target.value)} style={{ width: 100 }}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <button className="btn btn-primary" onClick={handleAddSecret} disabled={!addKey}>Add</button>
                  <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>✕</button>
                </div>
              )}

              <div className="vault-secrets-list">
                {filteredSecrets.length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                    No secrets found. Scan the project or add manually.
                  </div>
                )}

                {filteredSecrets.map(s => {
                  const cat = CATEGORIES.find(c => c.value === s.category);
                  return (
                    <div key={s.key} className="vault-secret-card">
                      <div className="vault-secret-header">
                        <span className="vault-cat-badge" style={{ color: cat?.color, borderColor: `${cat?.color}44`, background: `${cat?.color}11` }}>
                          {cat?.label ?? s.category}
                        </span>
                        <span className="vault-secret-key">{s.key}</span>
                        <div className="vault-secret-actions">
                          <button className="btn btn-ghost vault-action-btn"
                            onClick={() => toggleShow(s.key)}>
                            {showValues[s.key] ? "👁️ Hide" : "👁️ Show"}
                          </button>
                          <button className="btn btn-ghost vault-action-btn"
                            onClick={() => copyValue(s.key, s.value)}>
                            {copied === s.key ? "✓ Copied" : "📋 Copy"}
                          </button>
                          <button className="btn btn-ghost vault-action-btn"
                            style={{ color: "var(--red)" }}
                            onClick={() => handleDeleteSecret(s.key)}>
                            🗑️
                          </button>
                        </div>
                      </div>
                      <div className="vault-secret-value">
                        {showValues[s.key] ? s.value : "•".repeat(Math.min(s.value.length, 40))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VaultkeeperPage;
