import React, { useEffect, useState } from "react";
import Sidebar from "./components/Layout/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import ProjectPage from "./pages/ProjectPage";
import SearchPage from "./pages/SearchPage";
import GitHubHubPage from "./pages/GitHubHubPage";
import PingBoardPage from "./pages/PingBoardPage";
import MeridianPage from "./pages/MeridianPage";
import VaultkeeperPage from "./pages/VaultkeeperPage";
import JunkDetector from "./components/Dashboard/JunkDetector";
import { useStore } from "./store/useStore";
import { loadSettings, saveSettings, scanProjects, selectFolder, loadNotes } from "./lib/tauri";

import type { Settings } from "./types";

const App: React.FC = () => {
  const {
    settings, setSettings,
    selectedProject,
    setProjects, isScanning, setIsScanning, setScanError,
    activePage, setActivePage,
    showJunkModal, setShowJunkModal,
    setNotes,
  } = useStore();

  const [showSettings, setShowSettings]   = useState(false);
  const [draftSettings, setDraftSettings] = useState<Settings>({ projects_path: "", github_token: null });
  const [sidebarOpen, setSidebarOpen]     = useState(true);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      if (s.projects_path) scan(s.projects_path);
      else setShowSettings(true);
    }).catch(() => setShowSettings(true));
    loadNotes().then(setNotes).catch(() => {});
  }, []);

  const scan = async (path: string) => {
    setIsScanning(true); setScanError(null);
    try { setProjects(await scanProjects(path)); }
    catch (e) { setScanError(String(e)); }
    finally { setIsScanning(false); }
  };

  const handleOpenSettings = () => {
    setDraftSettings({ projects_path: settings?.projects_path ?? "", github_token: settings?.github_token ?? null });
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    await saveSettings(draftSettings);
    setSettings(draftSettings);
    setShowSettings(false);
    if (draftSettings.projects_path) scan(draftSettings.projects_path);
  };

  const handleSelectFolder = async () => {
    const path = await selectFolder();
    if (path) setDraftSettings((d) => ({ ...d, projects_path: path }));
  };

  const renderMain = () => {
    if (selectedProject) return <ProjectPage />;
    switch (activePage) {
      case "search":      return <SearchPage />;
      case "github-hub":  return <GitHubHubPage />;
      case "vaultkeeper": return <VaultkeeperPage />;
      case "meridian":    return <MeridianPage />;
      case "pingboard":   return <PingBoardPage />;
      default:            return <DashboardPage />;
    }
  };

  return (
    <div className="layout">
      {/* Sidebar with collapse */}
      <div className={`sidebar-wrapper ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        {sidebarOpen && (
          <Sidebar
            onSettingsClick={handleOpenSettings}
            onDashboardClick={() => setActivePage("dashboard")}
            onSearchClick={() => setActivePage("search")}
            onJunkClick={() => setShowJunkModal(true)}
          />
        )}

        {/* Toggle button */}
        <button
          className="sidebar-toggle-btn"
          onClick={() => setSidebarOpen((o) => !o)}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? "‹" : "›"}
        </button>
      </div>

      {/* Main */}
      <div className="main-content">
        <div className="scan-bar">
          {isScanning ? (
            <><div className="spinner" /><span>Scanning…</span></>
          ) : (
            <>
              <span>📁 {settings?.projects_path ?? "No folder configured"}</span>
              <button className="rescan-btn"
                onClick={() => settings?.projects_path && scan(settings.projects_path)}
                disabled={!settings?.projects_path || isScanning}>
                ↺ Rescan
              </button>
            </>
          )}
        </div>
        {renderMain()}
      </div>

      {showJunkModal && <JunkDetector />}

      {showSettings && (
        <div className="modal-overlay" onClick={() => settings?.projects_path && setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">⚙️ Settings</div>
            <div className="form-group">
              <label className="form-label">Projects Folder</label>
              <div className="form-input-row">
                <input className="form-input"
                  placeholder="C:\Users\You\Desktop\Projects"
                  value={draftSettings.projects_path}
                  onChange={(e) => setDraftSettings((d) => ({ ...d, projects_path: e.target.value }))} />
                <button className="btn btn-ghost" onClick={handleSelectFolder}>Browse</button>
              </div>
              <div className="form-hint">Root folder containing all your projects.</div>
            </div>
            <div className="form-group">
              <label className="form-label">GitHub Personal Access Token</label>
              <input className="form-input" type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={draftSettings.github_token ?? ""}
                onChange={(e) => setDraftSettings((d) => ({ ...d, github_token: e.target.value || null }))} />
              <div className="form-hint">Required for private repos and GitHub-only list. Scope: repo, read:user</div>
            </div>
            <div className="modal-actions">
              <div style={{ flex: 1 }} />
              {settings?.projects_path && (
                <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>Cancel</button>
              )}
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={!draftSettings.projects_path}>
                Save & Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
