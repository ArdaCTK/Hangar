import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getProjectDetails, getFileTree, openInExplorer } from "../lib/tauri";
import GitInfo from "../components/ProjectDetail/GitInfo";
import Dependencies from "../components/ProjectDetail/Dependencies";
import FileTree from "../components/ProjectDetail/FileTree";
import ReadmeViewer from "../components/ProjectDetail/ReadmeViewer";
import type { FileNode } from "../types";

type Tab = "overview" | "git" | "files" | "deps" | "docs" | "apis";

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "git", label: "Git / GitHub" },
  { id: "files", label: "Files" },
  { id: "deps", label: "Dependencies" },
  { id: "docs", label: "Docs" },
  { id: "apis", label: "APIs" },
];

const ProjectPage: React.FC = () => {
  const {
    selectedProject,
    setSelectedProject,
    detailsCache,
    setDetails,
    loadingDetails,
    setLoadingDetails,
  } = useStore();

  const [tab, setTab] = useState<Tab>("overview");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const details = selectedProject ? detailsCache[selectedProject] : null;
  const isLoading = selectedProject ? (loadingDetails[selectedProject] ?? false) : false;

  useEffect(() => {
    if (!selectedProject || details || isLoading) return;
    setLoadingDetails(selectedProject, true);
    setError(null);
    getProjectDetails(selectedProject)
      .then((d) => setDetails(selectedProject, d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoadingDetails(selectedProject, false));
  }, [selectedProject]);

  useEffect(() => {
    if (tab !== "files" || !selectedProject || fileTree.length > 0 || fileTreeLoading) return;
    setFileTreeLoading(true);
    getFileTree(selectedProject)
      .then(setFileTree)
      .catch(() => {})
      .finally(() => setFileTreeLoading(false));
  }, [tab, selectedProject]);

  if (!selectedProject) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📂</div>
        <div className="empty-state-title">Select a project</div>
        <div className="empty-state-desc">Choose a project from the sidebar to view details.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-state" style={{ height: "100%" }}>
        <div className="spinner" />
        <span>Loading project…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "28px" }}>
        <div className="error-banner">Failed to load project: {error}</div>
        <button
          className="btn btn-ghost"
          style={{ marginTop: "12px" }}
          onClick={() => setSelectedProject(null)}
        >
          ← Back
        </button>
      </div>
    );
  }

  if (!details) return null;

  const p = details.info;
  const projectName = selectedProject.split(/[/\\]/).pop() ?? selectedProject;

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="detail-header">
        <div className="detail-header-top">
          <button className="back-btn" onClick={() => setSelectedProject(null)}>
            ← Dashboard
          </button>
          <span style={{ color: "var(--border2)" }}>›</span>
          <span className="detail-title">{projectName}</span>

          <div className="detail-badges">
            <span className="project-card-type">{p.project_type}</span>
            <span className={`git-badge ${p.has_git ? "" : "no-git"}`}>
              {p.has_git ? "Git ✓" : "No Git"}
            </span>
            {p.languages.slice(0, 3).map((l) => (
              <span key={l} className="lang-tag">{l}</span>
            ))}
            <button
              className="btn btn-ghost"
              style={{ padding: "3px 8px", fontSize: "11px" }}
              onClick={() => openInExplorer(selectedProject)}
            >
              📂 Open
            </button>
          </div>
        </div>

        <div className="tabs">
          {TAB_LABELS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "deps" && details.dependencies.length > 0 && (
                <span style={{ marginLeft: "5px", color: "var(--text3)", fontSize: "10px" }}>
                  {details.dependencies.length}
                </span>
              )}
              {t.id === "apis" && details.api_connections.length > 0 && (
                <span style={{ marginLeft: "5px", color: "var(--text3)", fontSize: "10px" }}>
                  {details.api_connections.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="detail-body">
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div>
            <div className="info-grid" style={{ marginBottom: "20px" }}>
              <div className="info-card">
                <div className="info-card-label">Files</div>
                <div className="info-card-value blue">{p.file_count.toLocaleString()}</div>
              </div>
              <div className="info-card">
                <div className="info-card-label">Size</div>
                <div className="info-card-value">
                  {p.total_size < 1024 * 1024
                    ? `${(p.total_size / 1024).toFixed(0)} KB`
                    : `${(p.total_size / 1024 / 1024).toFixed(1)} MB`}
                </div>
              </div>
              <div className="info-card">
                <div className="info-card-label">Dependencies</div>
                <div className="info-card-value yellow">{details.dependencies.length}</div>
              </div>
              <div className="info-card">
                <div className="info-card-label">API Connections</div>
                <div className="info-card-value orange">{details.api_connections.length}</div>
              </div>
              <div className="info-card">
                <div className="info-card-label">Branches</div>
                <div className="info-card-value">{details.git_branches.length}</div>
              </div>
              <div className="info-card">
                <div className="info-card-label">Commits</div>
                <div className="info-card-value">{details.git_log.length}+</div>
              </div>
            </div>

            {p.remote_url && (
              <div className="section-block">
                <div className="section-block-title">Remote</div>
                <div className="remote-url">{p.remote_url}</div>
              </div>
            )}

            {details.git_log.length > 0 && (
              <div className="section-block">
                <div className="section-block-title">Last Commit</div>
                <div className="commit-list">
                  <div className="commit-item">
                    <span className="commit-hash">{details.git_log[0].short_hash}</span>
                    <span className="commit-message">{details.git_log[0].message}</span>
                    <span className="commit-author">{details.git_log[0].author}</span>
                    <span className="commit-date">{details.git_log[0].date.slice(0, 10)}</span>
                  </div>
                </div>
              </div>
            )}

            {p.frameworks.length > 0 && (
              <div className="section-block">
                <div className="section-block-title">Frameworks & Tools</div>
                <div className="branch-list">
                  {p.frameworks.map((f) => (
                    <span key={f} className="branch-tag" style={{ color: "var(--blue)", borderColor: "rgba(91,156,246,0.25)" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Git / GitHub ── */}
        {tab === "git" && (
          p.has_git
            ? <GitInfo details={details} />
            : (
              <div className="docs-empty">
                <div className="empty-state-icon">🔗</div>
                <div className="empty-state-title">No Git repository</div>
                <div className="empty-state-desc">
                  This project does not have a .git directory.
                </div>
              </div>
            )
        )}

        {/* ── Files ── */}
        {tab === "files" && (
          <FileTree nodes={fileTree} loading={fileTreeLoading} />
        )}

        {/* ── Dependencies ── */}
        {tab === "deps" && <Dependencies dependencies={details.dependencies} />}

        {/* ── Docs ── */}
        {tab === "docs" && <ReadmeViewer docs={details.docs} />}

        {/* ── APIs ── */}
        {tab === "apis" && (
          details.api_connections.length > 0 ? (
            <div>
              <div className="section-block-title" style={{ marginBottom: "12px" }}>
                Detected API Connections ({details.api_connections.length})
              </div>
              <div className="api-list">
                {details.api_connections.map((a, i) => (
                  <div className="api-item" key={i}>
                    <span className="api-key">{a.key}</span>
                    <span className="api-hint">{a.hint}</span>
                    <span className="api-source">{a.source}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="docs-empty">
              <div className="empty-state-icon">🔌</div>
              <div className="empty-state-title">No API connections detected</div>
              <div className="empty-state-desc">
                No .env files, URL patterns, or API client packages were found.
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ProjectPage;
