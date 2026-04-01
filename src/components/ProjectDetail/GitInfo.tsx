import React, { useEffect, useState } from "react";
import type { ProjectDetails, GitHubData } from "../../types";
import { fetchGitHub, gitCheckout } from "../../lib/tauri";
import { useStore } from "../../store/useStore";

interface Props {
  details: ProjectDetails;
  onBranchChange?: (newBranch: string) => void;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const m =
    url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(\.git)?$/) ??
    url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

const GitInfo: React.FC<Props> = ({ details, onBranchChange }) => {
  const { settings, githubCache, setGitHub, loadingGitHub, setLoadingGitHub } = useStore();
  const [tab, setTab] = useState<"local" | "github">("local");
  const [ghError, setGhError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(details.git_current_branch);

  const ghParsed = details.info.remote_url
    ? parseGitHubUrl(details.info.remote_url)
    : null;
  const ghKey = ghParsed ? `${ghParsed.owner}/${ghParsed.repo}` : null;
  const ghData: GitHubData | null = ghKey ? (githubCache[ghKey] ?? null) : null;
  const isLoading = ghKey ? (loadingGitHub[ghKey] ?? false) : false;

  useEffect(() => {
    if (!ghParsed || !ghKey || ghData || isLoading) return;
    setLoadingGitHub(ghKey, true);
    setGhError(null);
    fetchGitHub(ghParsed.owner, ghParsed.repo, settings?.github_token ?? null)
      .then((d) => setGitHub(ghKey, d))
      .catch((e) => setGhError(String(e)))
      .finally(() => setLoadingGitHub(ghKey, false));
  }, [ghKey]);

  const handleCheckout = async (branch: string) => {
    setCheckingOut(branch);
    setCheckoutError(null);
    try {
      await gitCheckout(details.info.path, branch);
      setCurrentBranch(branch);
      onBranchChange?.(branch);
    } catch (e) {
      setCheckoutError(String(e));
    } finally {
      setCheckingOut(null);
    }
  };

  const { git_log, git_branches } = details;

  return (
    <div>
      <div className="docs-tabs">
        <button className={`docs-tab-btn ${tab === "local" ? "active" : ""}`} onClick={() => setTab("local")}>
          Local Git
        </button>
        {ghParsed && (
          <button className={`docs-tab-btn ${tab === "github" ? "active" : ""}`} onClick={() => setTab("github")}>
            GitHub
          </button>
        )}
      </div>

      {tab === "local" && (
        <div>
          {details.info.remote_url && (
            <div className="section-block">
              <div className="section-block-title">Remote</div>
              <div className="remote-url">{details.info.remote_url}</div>
            </div>
          )}

          {checkoutError && (
            <div className="error-banner" style={{ marginBottom: "12px" }}>
              Checkout failed: {checkoutError}
            </div>
          )}

          {/* Branches with checkout buttons */}
          <div className="section-block">
            <div className="section-block-title">
              Branches ({git_branches.length})
              <span style={{ marginLeft: 8, fontSize: "10px", color: "var(--text3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                click to switch
              </span>
            </div>
            <div className="branch-list">
              {git_branches.map((b) => {
                const trimmed = b.trim();
                const isCurrent = trimmed === currentBranch;
                const isLoading = checkingOut === trimmed;
                return (
                  <button
                    key={trimmed}
                    onClick={() => !isCurrent && !checkingOut && handleCheckout(trimmed)}
                    disabled={isCurrent || !!checkingOut}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: "3px",
                      background: isCurrent ? "rgba(91,156,246,0.1)" : "var(--bg3)",
                      border: `1px solid ${isCurrent ? "rgba(91,156,246,0.3)" : "var(--border)"}`,
                      color: isCurrent ? "var(--blue)" : "var(--text2)",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      cursor: isCurrent ? "default" : checkingOut ? "wait" : "pointer",
                      transition: "all 0.12s",
                      opacity: checkingOut && !isCurrent && checkingOut !== trimmed ? 0.5 : 1,
                    }}
                    title={isCurrent ? "Current branch" : `Switch to ${trimmed}`}
                  >
                    {isLoading ? (
                      <span style={{ display: "inline-block", width: 7, height: 7, border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    ) : (
                      isCurrent && <span>●</span>
                    )}
                    {trimmed}
                    {!isCurrent && !isLoading && (
                      <span style={{ opacity: 0.4, fontSize: 9 }}>↗</span>
                    )}
                  </button>
                );
              })}
              {git_branches.length === 0 && (
                <span style={{ color: "var(--text3)", fontSize: "12px" }}>No branches found</span>
              )}
            </div>
          </div>

          <div className="section-block">
            <div className="section-block-title">Recent Commits ({git_log.length})</div>
            {git_log.length > 0 ? (
              <div className="commit-list">
                {git_log.map((c) => (
                  <div className="commit-item" key={c.hash}>
                    <span className="commit-hash">{c.short_hash}</span>
                    <span className="commit-message">{c.message}</span>
                    <span className="commit-author">{c.author}</span>
                    <span className="commit-date">{c.date.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text3)", fontSize: "12px" }}>No commits found</div>
            )}
          </div>
        </div>
      )}

      {tab === "github" && ghParsed && (
        <div>
          {isLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <span>Fetching from GitHub…</span>
            </div>
          )}
          {ghError && (
            <div className="error-banner">
              GitHub API error: {ghError}
              {!settings?.github_token && " — Add a GitHub token in Settings for private repos & higher rate limits."}
            </div>
          )}
          {ghData && (
            <>
              {ghData.description && (
                <div style={{ color: "var(--text2)", fontSize: "13px", marginBottom: "16px" }}>
                  {ghData.description}
                </div>
              )}
              <div className="info-grid">
                <div className="info-card"><div className="info-card-label">Stars</div><div className="info-card-value yellow">★ {ghData.stars.toLocaleString()}</div></div>
                <div className="info-card"><div className="info-card-label">Forks</div><div className="info-card-value blue">{ghData.forks.toLocaleString()}</div></div>
                <div className="info-card"><div className="info-card-label">Open Issues</div><div className="info-card-value orange">{ghData.open_issues.toLocaleString()}</div></div>
                <div className="info-card"><div className="info-card-label">Open PRs</div><div className="info-card-value purple">{ghData.open_prs.toLocaleString()}</div></div>
                <div className="info-card"><div className="info-card-label">Watchers</div><div className="info-card-value">{ghData.watchers.toLocaleString()}</div></div>
                <div className="info-card"><div className="info-card-label">Size</div><div className="info-card-value" style={{ fontSize: "14px" }}>{ghData.size_kb >= 1024 ? `${(ghData.size_kb/1024).toFixed(1)} MB` : `${ghData.size_kb} KB`}</div></div>
              </div>
              {ghData.topics.length > 0 && (
                <div className="section-block">
                  <div className="section-block-title">Topics</div>
                  <div className="branch-list">
                    {ghData.topics.map((t) => (<span key={t} className="branch-tag">{t}</span>))}
                  </div>
                </div>
              )}
              <div className="section-block">
                <div className="section-block-title">Branches on GitHub ({ghData.branches.length})</div>
                <div className="branch-list">
                  {ghData.branches.map((b) => (
                    <span key={b} className={`branch-tag ${b === ghData.default_branch ? "current" : ""}`}>
                      {b === ghData.default_branch && "● "}{b}
                    </span>
                  ))}
                </div>
              </div>
              <div className="section-block">
                <div className="section-block-title">Recent Commits ({ghData.commits.length})</div>
                <div className="commit-list">
                  {ghData.commits.map((c) => (
                    <div className="commit-item" key={c.hash}>
                      <span className="commit-hash">{c.short_hash}</span>
                      <span className="commit-message">{c.message}</span>
                      <span className="commit-author">{c.author}</span>
                      <span className="commit-date">{c.date.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: "12px", display: "flex", gap: "16px" }}>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>Created {ghData.created_at.slice(0, 10)}</span>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>Updated {ghData.updated_at.slice(0, 10)}</span>
                {ghData.license_name && <span style={{ fontSize: "11px", color: "var(--text3)" }}>License: {ghData.license_name}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GitInfo;
