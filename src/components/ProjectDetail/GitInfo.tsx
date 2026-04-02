import React, { useEffect, useState } from "react";
import type { ProjectDetails, GitHubData, GitCommit } from "../../types";
import { fetchGitHub, gitCheckout, getGitLogForBranch } from "../../lib/tauri";
import { useStore } from "../../store/useStore";

interface Props { details: ProjectDetails; }

function parseGitHubUrl(url: string) {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(\.git)?$/)
           ?? url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

const CommitList: React.FC<{ commits: GitCommit[] }> = ({ commits }) => (
  commits.length === 0
    ? <div style={{ color: "var(--text3)", fontSize: 12 }}>No commits found</div>
    : <div className="commit-list">
        {commits.map((c) => (
          <div className="commit-item" key={c.hash}>
            <span className="commit-hash">{c.short_hash}</span>
            <span className="commit-message">{c.message}</span>
            <span className="commit-author">{c.author}</span>
            <span className="commit-date">{c.date.slice(0,10)}</span>
          </div>
        ))}
      </div>
);

const GitInfo: React.FC<Props> = ({ details }) => {
  const { settings, githubCache, setGitHub, loadingGitHub, setLoadingGitHub } = useStore();
  const [tab, setTab]               = useState<"local" | "github">("local");
  const [ghError, setGhError]       = useState<string | null>(null);
  const [checkoutErr, setCheckoutErr] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState(details.git_current_branch);
  const [localCommits, setLocalCommits]   = useState(details.git_log);
  const [logLoading, setLogLoading]       = useState(false);

  // GitHub state
  const [ghBranch, setGhBranch] = useState<string | null>(null);
  const [ghBranchCommits, setGhBranchCommits] = useState<GitCommit[] | null>(null);
  const [ghBranchLoading, setGhBranchLoading] = useState(false);

  const ghParsed = details.info.remote_url ? parseGitHubUrl(details.info.remote_url) : null;
  const ghKey    = ghParsed ? `${ghParsed.owner}/${ghParsed.repo}` : null;
  const ghData: GitHubData | null = ghKey ? (githubCache[ghKey] ?? null) : null;
  const isGhLoading = ghKey ? (loadingGitHub[ghKey] ?? false) : false;

  useEffect(() => {
    if (!ghParsed || !ghKey || ghData || isGhLoading) return;
    setLoadingGitHub(ghKey, true);
    setGhError(null);
    fetchGitHub(ghParsed.owner, ghParsed.repo, settings?.github_token ?? null)
      .then((d) => { setGitHub(ghKey, d); setGhBranch(d.default_branch); })
      .catch((e) => setGhError(String(e)))
      .finally(() => setLoadingGitHub(ghKey, false));
  }, [ghKey]);

  // When ghData arrives, set default selected branch
  useEffect(() => {
    if (ghData && !ghBranch) setGhBranch(ghData.default_branch);
  }, [ghData]);

  // Fetch commits for selected GitHub branch
  useEffect(() => {
    if (!ghBranch || !ghParsed) return;
    // Use ghData.commits for default branch (already fetched)
    if (ghData && ghBranch === ghData.default_branch) {
      setGhBranchCommits(null); return;
    }
    // Otherwise fetch via local git log for that remote branch
    setGhBranchLoading(true);
    getGitLogForBranch(details.info.path, `origin/${ghBranch}`, 30)
      .then(setGhBranchCommits)
      .catch(() => setGhBranchCommits([]))
      .finally(() => setGhBranchLoading(false));
  }, [ghBranch]);

  const handleCheckout = async (branch: string) => {
    if (branch === currentBranch || checkingOut) return;
    setCheckingOut(branch);
    setCheckoutErr(null);
    try {
      await gitCheckout(details.info.path, branch);
      setCurrentBranch(branch);
      // Refresh commits for new branch
      setLogLoading(true);
      const newLog = await getGitLogForBranch(details.info.path, branch, 50);
      setLocalCommits(newLog);
    } catch (e) {
      setCheckoutErr(String(e));
    } finally {
      setCheckingOut(null);
      setLogLoading(false);
    }
  };

  const displayedGhCommits = ghBranchCommits ?? ghData?.commits ?? [];

  return (
    <div>
      <div className="docs-tabs">
        <button className={`docs-tab-btn ${tab === "local" ? "active" : ""}`} onClick={() => setTab("local")}>Local Git</button>
        {ghParsed && <button className={`docs-tab-btn ${tab === "github" ? "active" : ""}`} onClick={() => setTab("github")}>GitHub</button>}
      </div>

      {/* ── LOCAL ── */}
      {tab === "local" && (
        <div>
          {details.info.remote_url && (
            <div className="section-block">
              <div className="section-block-title">Remote</div>
              <div className="remote-url">{details.info.remote_url}</div>
            </div>
          )}

          {checkoutErr && <div className="error-banner" style={{ marginBottom: 12 }}>Checkout failed: {checkoutErr}</div>}

          <div className="section-block">
            <div className="section-block-title">
              Branches ({details.git_branches.length})
              <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                click to switch
              </span>
            </div>
            <div className="branch-list">
              {details.git_branches.map((b) => {
                const trimmed = b.trim();
                const isCurrent = trimmed === currentBranch;
                const isLoading = checkingOut === trimmed;
                return (
                  <button key={trimmed}
                    onClick={() => handleCheckout(trimmed)}
                    disabled={isCurrent || !!checkingOut}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 3,
                      background: isCurrent ? "rgba(91,156,246,0.1)" : "var(--bg3)",
                      border: `1px solid ${isCurrent ? "rgba(91,156,246,0.3)" : "var(--border)"}`,
                      color: isCurrent ? "var(--blue)" : "var(--text2)",
                      fontSize: 11, fontFamily: "var(--font-mono)",
                      cursor: isCurrent ? "default" : checkingOut ? "wait" : "pointer",
                      opacity: checkingOut && !isCurrent && checkingOut !== trimmed ? 0.5 : 1,
                      transition: "all 0.12s",
                    }}>
                    {isLoading
                      ? <span style={{ width: 7, height: 7, border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                      : isCurrent && <span>●</span>}
                    {trimmed}
                    {!isCurrent && !isLoading && <span style={{ opacity: 0.4, fontSize: 9 }}>↗</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="section-block">
            <div className="section-block-title">
              Commits on{" "}
              <span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{currentBranch ?? "unknown"}</span>
              {" "}({localCommits.length})
            </div>
            {logLoading
              ? <div className="loading-state" style={{ height: 60 }}><div className="spinner" /><span>Loading commits…</span></div>
              : <CommitList commits={localCommits} />}
          </div>
        </div>
      )}

      {/* ── GITHUB ── */}
      {tab === "github" && ghParsed && (
        <div>
          {isGhLoading && <div className="loading-state"><div className="spinner" /><span>Fetching from GitHub…</span></div>}
          {ghError && <div className="error-banner">{ghError}{!settings?.github_token && " — Add a GitHub token in Settings."}</div>}

          {ghData && (
            <>
              {ghData.description && <div style={{ color: "var(--text2)", fontSize: 13, marginBottom: 16 }}>{ghData.description}</div>}

              <div className="info-grid">
                {[
                  ["Stars",       `★ ${ghData.stars.toLocaleString()}`,       "yellow"],
                  ["Forks",       ghData.forks.toLocaleString(),              "blue"],
                  ["Open Issues", ghData.open_issues.toLocaleString(),        "orange"],
                  ["Open PRs",    ghData.open_prs.toLocaleString(),           "purple"],
                  ["Watchers",    ghData.watchers.toLocaleString(),           ""],
                  ["Size",        ghData.size_kb >= 1024 ? `${(ghData.size_kb/1024).toFixed(1)} MB` : `${ghData.size_kb} KB`, ""],
                ].map(([label, val, cls]) => (
                  <div className="info-card" key={label}>
                    <div className="info-card-label">{label}</div>
                    <div className={`info-card-value ${cls}`} style={{ fontSize: 16 }}>{val}</div>
                  </div>
                ))}
              </div>

              {ghData.topics.length > 0 && (
                <div className="section-block">
                  <div className="section-block-title">Topics</div>
                  <div className="branch-list">{ghData.topics.map((t) => <span key={t} className="branch-tag">{t}</span>)}</div>
                </div>
              )}

              {/* Branch selector for commit history */}
              <div className="section-block">
                <div className="section-block-title">
                  Branches ({ghData.branches.length})
                  <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                    click to view commits
                  </span>
                </div>
                <div className="branch-list">
                  {ghData.branches.map((b) => (
                    <button key={b}
                      onClick={() => setGhBranch(b)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 3,
                        background: b === ghBranch ? "rgba(91,156,246,0.1)" : "var(--bg3)",
                        border: `1px solid ${b === ghBranch ? "rgba(91,156,246,0.3)" : "var(--border)"}`,
                        color: b === ghBranch ? "var(--blue)" : "var(--text2)",
                        fontSize: 11, fontFamily: "var(--font-mono)", cursor: "pointer",
                        transition: "all 0.12s",
                      }}>
                      {b === ghData.default_branch && <span>●</span>}
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="section-block">
                <div className="section-block-title">
                  Commits on{" "}
                  <span style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{ghBranch}</span>
                </div>
                {ghBranchLoading
                  ? <div className="loading-state" style={{ height: 60 }}><div className="spinner" /><span>Loading…</span></div>
                  : <CommitList commits={displayedGhCommits} />}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Created {ghData.created_at.slice(0,10)}</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Updated {ghData.updated_at.slice(0,10)}</span>
                {ghData.license_name && <span style={{ fontSize: 11, color: "var(--text3)" }}>⚖ {ghData.license_name}</span>}
                <span style={{ fontSize: 11, color: ghData.private ? "var(--yellow)" : "var(--green)" }}>
                  {ghData.private ? "🔒 Private" : "🌐 Public"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GitInfo;
