import React, { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { getProjectDetails, getFileTree, openInExplorer, openInVscode } from "../lib/tauri";
import GitInfo from "../components/ProjectDetail/GitInfo";
import Dependencies from "../components/ProjectDetail/Dependencies";
import FileTree from "../components/ProjectDetail/FileTree";
import ReadmeViewer from "../components/ProjectDetail/ReadmeViewer";
import Terminal from "../components/ProjectDetail/Terminal";
import NotesPanel from "../components/ProjectDetail/NotesPanel";
import type { FileNode } from "../types";

type Tab = "overview" | "git" | "files" | "deps" | "docs" | "apis" | "terminal" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview"     },
  { id: "git",       label: "Git / GitHub" },
  { id: "files",     label: "Files"        },
  { id: "deps",      label: "Dependencies" },
  { id: "docs",      label: "Docs"         },
  { id: "apis",      label: "APIs"         },
  { id: "terminal",  label: "Terminal"     },
  { id: "notes",     label: "Notes"        },
];

const ProjectPage: React.FC = () => {
  const {
    selectedProject, setSelectedProject,
    detailsCache, setDetails, loadingDetails, setLoadingDetails,
    notes,
    githubCache,
  } = useStore();

  const [tab, setTab]             = useState<Tab>("overview");
  const [fileTree, setFileTree]   = useState<FileNode[]>([]);
  const [fileTreeLoading, setFTL] = useState(false);
  const [fileTreeLoadedFor, setFileTreeLoadedFor] = useState<string | null>(null);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  // FIX: Retry sayacı — error state'inden sonra yeniden denemeye izin verir.
  // Önceki implementasyonda fileTreeError guard'da yer aldığından retry imkânsızdı.
  const [fileTreeRetry, setFileTreeRetry] = useState(0);
  const [error, setError]         = useState<string | null>(null);

  const details    = selectedProject ? detailsCache[selectedProject] : null;
  const isLoading  = selectedProject ? (loadingDetails[selectedProject] ?? false) : false;
  const projectNote = selectedProject ? notes[selectedProject] : null;

  // Proje değiştiğinde file tree state'ini sıfırla
  useEffect(() => {
    setTab("overview");
    setFileTree([]);
    setFileTreeLoadedFor(null);
    setFileTreeError(null);
    setFileTreeRetry(0);
  }, [selectedProject]);

  // FIX: Tab "files"'a geçildiğinde error state sıfırlanır; böylece
  // tab değiştirip geri dönmek otomatik retry görevi görür.
  useEffect(() => {
    if (tab === "files" && fileTreeError) {
      setFileTreeError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
    // FIX: fileTreeError artık guard'da değil — retry mümkün.
    // Yalnızca şu koşullarda yükleme atlanır:
    //   1. "files" tabı aktif değil
    //   2. selectedProject yok
    //   3. Zaten yükleniyor
    //   4. Bu proje için zaten başarıyla yüklenmiş (ve hata yok)
    if (tab !== "files" || !selectedProject || fileTreeLoading) return;
    if (fileTreeLoadedFor === selectedProject && fileTree.length > 0) return;

    setFTL(true);
    setFileTreeError(null);
    getFileTree(selectedProject)
      .then((nodes) => {
        setFileTree(nodes);
        setFileTreeLoadedFor(selectedProject);
      })
      .catch((e) => {
        setFileTreeError(String(e));
      })
      .finally(() => setFTL(false));
  // fileTreeRetry bağımlılığı: kullanıcı retry butonuna basınca yeniden tetiklenir.
  }, [tab, selectedProject, fileTreeLoading, fileTreeLoadedFor, fileTree.length, fileTreeRetry]);

  if (!selectedProject) return (
    <div className="empty-state">
      <div className="empty-state-icon">📂</div>
      <div className="empty-state-title">Select a project</div>
      <div className="empty-state-desc">Choose a project from the sidebar.</div>
    </div>
  );

  if (isLoading) return (
    <div className="loading-state" style={{ height: "100%" }}>
      <div className="spinner" /><span>Loading project…</span>
    </div>
  );

  if (error) return (
    <div style={{ padding: 28 }}>
      <div className="error-banner">Failed to load project: {error}</div>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelectedProject(null)}>← Back</button>
    </div>
  );

  if (!details) return null;

  const p = details.info;
  const projectName = selectedProject.split(/[/\\]/).pop() ?? selectedProject;

  const ghKey = p.github_owner && p.github_repo ? `${p.github_owner}/${p.github_repo}` : null;
  const ghData = ghKey ? githubCache[ghKey] : null;
  const visibilityLabel = ghData ? (ghData.private ? "🔒 private" : "🌐 public") : null;

  return (
    <div className="project-detail">
      <div className="detail-header">
        <div className="detail-header-top">
          <button className="back-btn" onClick={() => setSelectedProject(null)}>← Dashboard</button>
          <span style={{ color: "var(--border2)" }}>›</span>
          <span className="detail-title">{projectName}</span>

          <div className="detail-badges">
            <span className="project-card-type">{p.project_type}</span>
            <span className={`git-badge ${p.has_git ? "" : "no-git"}`}>
              {p.has_git ? "Git ✓" : "No Git"}
            </span>
            {visibilityLabel && (
              <span className="project-card-type" style={{ color: ghData?.private ? "var(--yellow)" : "var(--green)" }}>
                {visibilityLabel}
              </span>
            )}
            {p.languages.slice(0, 3).map((l) => <span key={l} className="lang-tag">{l}</span>)}
            {projectNote?.tags?.slice(0, 2).map((t) => (
              <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "rgba(91,156,246,0.1)", color: "var(--blue)", border: "1px solid rgba(91,156,246,0.2)" }}>
                {t}
              </span>
            ))}
            <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => openInExplorer(selectedProject)}>
              📂 Open
            </button>
            <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => openInVscode(selectedProject)}>
              ⌨ VS Code
            </button>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === "deps" && details.dependencies.length > 0 && (
                <span style={{ marginLeft: 4, color: "var(--text3)", fontSize: 10 }}>{details.dependencies.length}</span>
              )}
              {t.id === "apis" && details.api_connections.length > 0 && (
                <span style={{ marginLeft: 4, color: "var(--text3)", fontSize: 10 }}>{details.api_connections.length}</span>
              )}
              {t.id === "notes" && projectNote?.note && (
                <span style={{ marginLeft: 4, fontSize: 8 }}>●</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-body">
        {tab === "overview" && (
          <div>
            <div className="info-grid" style={{ marginBottom: 20 }}>
              <div className="info-card"><div className="info-card-label">Files</div><div className="info-card-value blue">{p.file_count.toLocaleString()}</div></div>
              <div className="info-card"><div className="info-card-label">Size</div><div className="info-card-value">{p.total_size < 1024*1024 ? `${(p.total_size/1024).toFixed(0)} KB` : `${(p.total_size/1024/1024).toFixed(1)} MB`}</div></div>
              <div className="info-card"><div className="info-card-label">Dependencies</div><div className="info-card-value yellow">{details.dependencies.length || p.dep_count}</div></div>
              <div className="info-card"><div className="info-card-label">API Connections</div><div className="info-card-value orange">{details.api_connections.length}</div></div>
              <div className="info-card"><div className="info-card-label">Branches</div><div className="info-card-value">{details.git_branches.length}</div></div>
              <div className="info-card"><div className="info-card-label">Commits</div><div className="info-card-value">{details.git_log.length}+</div></div>
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
                    <span className="commit-date">{details.git_log[0].date.slice(0,10)}</span>
                  </div>
                </div>
              </div>
            )}
            {p.frameworks.length > 0 && (
              <div className="section-block">
                <div className="section-block-title">Frameworks & Tools</div>
                <div className="branch-list">
                  {p.frameworks.map((f) => (
                    <span key={f} className="branch-tag" style={{ color: "var(--blue)", borderColor: "rgba(91,156,246,0.25)" }}>{f}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "git" && (p.has_git
          ? <GitInfo details={details} />
          : <div className="docs-empty"><div className="empty-state-icon">🔗</div><div className="empty-state-title">No Git repository</div></div>
        )}

        {tab === "files" && (
          <>
            {/* FIX: Hata durumunda retry butonu gösteriliyor */}
            {fileTreeError && (
              <div className="error-banner" style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Failed to load file tree: {fileTreeError}</span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, marginLeft: 12, flexShrink: 0 }}
                  onClick={() => {
                    setFileTreeError(null);
                    setFileTreeRetry((r) => r + 1);
                  }}
                >
                  ↺ Retry
                </button>
              </div>
            )}
            <FileTree nodes={fileTree} loading={fileTreeLoading} />
          </>
        )}

        {tab === "deps"     && <Dependencies dependencies={details.dependencies} />}
        {tab === "docs"     && <ReadmeViewer docs={details.docs} projectPath={selectedProject} />}

        {tab === "apis" && (
          details.api_connections.length > 0 ? (
            <div>
              <div className="section-block-title" style={{ marginBottom: 12 }}>
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
            </div>
          )
        )}

        {tab === "terminal" && (
          <Terminal projectPath={selectedProject} projectName={projectName} />
        )}

        {tab === "notes" && <NotesPanel projectPath={selectedProject} />}
      </div>
    </div>
  );
};

export default ProjectPage;
