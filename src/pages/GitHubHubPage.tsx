import React, { useEffect, useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { fetchAllReposIssues, fetchGitHubComments, postGitHubComment } from "../lib/tauri";
import type { GitHubIssue, GitHubComment } from "../types";
import ReactMarkdown from "react-markdown";

type FilterTab = "all" | "issues" | "prs";
type StateFilter = "open" | "closed" | "all";

const GitHubHubPage: React.FC = () => {
  const { settings, ghIssues, setGhIssues, ghHubLoading, setGhHubLoading } = useStore();

  const [filterTab, setFilterTab]   = useState<FilterTab>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("open");
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [comments, setComments]     = useState<GitHubComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting]       = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ghError, setGhError]       = useState<string | null>(null);

  const token = settings?.github_token ?? "";
  const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e);

  useEffect(() => {
    if (!token) return;
    setGhError(null);
    setGhHubLoading(true);
    fetchAllReposIssues(token, stateFilter === "all" ? "all" : stateFilter)
      .then(setGhIssues)
      .catch((e) => { setGhError(errorMessage(e)); })
      .finally(() => setGhHubLoading(false));
  }, [token, stateFilter]);

  const repos = useMemo(() => {
    const set = new Set(ghIssues.map((i) => i.repo_full_name));
    return Array.from(set).sort();
  }, [ghIssues]);

  const filtered = useMemo(() => {
    return ghIssues.filter((i) => {
      if (filterTab === "issues" && i.is_pull_request) return false;
      if (filterTab === "prs" && !i.is_pull_request) return false;
      if (repoFilter && i.repo_full_name !== repoFilter) return false;
      if (searchQuery && !i.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [ghIssues, filterTab, repoFilter, searchQuery]);

  const loadComments = async (issue: GitHubIssue) => {
    setSelectedIssue(issue);
    setComments([]);
    setCommentsLoading(true);
    setGhError(null);
    const [owner, repo] = issue.repo_full_name.split("/");
    try {
      const c = await fetchGitHubComments(owner, repo, issue.number, token);
      setComments(c);
    } catch (e) {
      setGhError(errorMessage(e));
    }
    setCommentsLoading(false);
  };

  const handlePostComment = async () => {
    if (!selectedIssue || !commentBody.trim()) return;
    setPosting(true);
    setGhError(null);
    const [owner, repo] = selectedIssue.repo_full_name.split("/");
    try {
      const c = await postGitHubComment(owner, repo, selectedIssue.number, commentBody, token);
      setComments((prev) => [...prev, c]);
      setCommentBody("");
    } catch (e) {
      setGhError(errorMessage(e));
    }
    setPosting(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (!token) {
    return (
      <div className="empty-state" style={{ height: "100%" }}>
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">GitHub Token Required</div>
        <div className="empty-state-desc">Add your GitHub Personal Access Token in Settings to use GitHub Hub.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="page-header">
        <div className="page-title">📋 GitHub Hub</div>
        <div className="page-subtitle">Issues & Pull Requests across all repositories</div>
      </div>

      <div className="ghub-toolbar">
        <div className="ghub-tabs">
          {(["all", "issues", "prs"] as FilterTab[]).map((t) => (
            <button key={t} className={`ghub-tab ${filterTab === t ? "active" : ""}`}
              onClick={() => setFilterTab(t)}>
              {t === "all" ? "All" : t === "issues" ? "🔴 Issues" : "🟣 Pull Requests"}
            </button>
          ))}
        </div>

        <div className="ghub-filters">
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as StateFilter)}
            className="ghub-select">
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>

          <select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}
            className="ghub-select" style={{ maxWidth: 200 }}>
            <option value="">All Repos</option>
            {repos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <input className="ghub-search" placeholder="Search issues…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* FIX: Rate limit veya genel hata bildirimi */}
      {ghError && (
        <div className="error-banner" style={{ margin: "8px 28px 0 28px" }}>
          {ghError}
        </div>
      )}

      {/* FIX: Kullanıcıya repo limiti (50) hakkında bilgi veriliyor;
           önceden bu limit tamamen sessizdi. */}
      {!ghHubLoading && !ghError && ghIssues.length > 0 && (
        <div style={{
          fontSize: 10,
          color: "var(--text3)",
          padding: "4px 28px",
          borderBottom: "1px solid var(--border)",
        }}>
          En son güncellenen en fazla 50 depodan issue gösterilmektedir
          {repos.length >= 50 && " — daha fazlası için repo filtresini kullanın"}
        </div>
      )}

      <div className="ghub-content">
        {/* Issue List */}
        <div className={`ghub-list ${selectedIssue ? "ghub-list-narrow" : ""}`}>
          {ghHubLoading && (
            <div className="loading-state"><div className="spinner" /><span>Loading issues…</span></div>
          )}

          {!ghHubLoading && filtered.length === 0 && (
            <div className="docs-empty">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">No issues found</div>
            </div>
          )}

          {!ghHubLoading && filtered.map((issue) => (
            <div key={`${issue.repo_full_name}-${issue.number}`}
              className={`ghub-issue-row ${selectedIssue?.id === issue.id ? "active" : ""}`}
              onClick={() => loadComments(issue)}>
              <div className="ghub-issue-icon">
                {issue.is_pull_request ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="5" cy="4" r="2" stroke="var(--purple)" strokeWidth="1.4" />
                    <circle cx="11" cy="12" r="2" stroke="var(--purple)" strokeWidth="1.4" />
                    <path d="M5 6v6M11 4v4" stroke="var(--purple)" strokeWidth="1.4" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke={issue.state === "open" ? "var(--green)" : "var(--red)"} strokeWidth="1.4" />
                    {issue.state === "open" ? (
                      <circle cx="8" cy="8" r="2" fill="var(--green)" />
                    ) : (
                      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--red)" strokeWidth="1.2" />
                    )}
                  </svg>
                )}
              </div>

              <div className="ghub-issue-main">
                <div className="ghub-issue-title">{issue.title}</div>
                <div className="ghub-issue-meta">
                  <span className="ghub-repo-badge">{issue.repo_full_name.split("/")[1]}</span>
                  <span>#{issue.number}</span>
                  <span>{timeAgo(issue.updated_at)}</span>
                  <span>by {issue.user_login}</span>
                  {issue.comments_count > 0 && (
                    <span className="ghub-comment-count">💬 {issue.comments_count}</span>
                  )}
                </div>
                {issue.labels.length > 0 && (
                  <div className="ghub-labels">
                    {issue.labels.map((l) => (
                      <span key={l.name} className="ghub-label"
                        style={{ background: `#${l.color}22`, color: `#${l.color}`, borderColor: `#${l.color}44` }}>
                        {l.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedIssue && (
          <div className="ghub-detail">
            <div className="ghub-detail-header">
              <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11 }}
                onClick={() => setSelectedIssue(null)}>✕ Close</button>
              <span className="ghub-detail-repo">{selectedIssue.repo_full_name}</span>
              <a href={selectedIssue.html_url} target="_blank" rel="noreferrer"
                className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11, marginLeft: "auto" }}>
                ↗ Open on GitHub
              </a>
            </div>

            <div className="ghub-detail-title">
              {selectedIssue.title}
              <span style={{ color: "var(--text3)", fontWeight: 400 }}> #{selectedIssue.number}</span>
            </div>

            <div className="ghub-detail-body">
              {selectedIssue.body ? (
                <div className="docs-content">
                  <ReactMarkdown>{selectedIssue.body}</ReactMarkdown>
                </div>
              ) : (
                <div style={{ color: "var(--text3)", fontStyle: "italic", padding: 12 }}>No description provided.</div>
              )}

              <div className="ghub-comments-section">
                <div className="section-block-title">
                  Comments ({commentsLoading ? "…" : comments.length})
                </div>

                {commentsLoading && <div className="loading-state" style={{ height: 80 }}><div className="spinner" /></div>}

                {!commentsLoading && comments.map((c) => (
                  <div key={c.id} className="ghub-comment">
                    <div className="ghub-comment-header">
                      <img src={c.user_avatar} alt="" className="ghub-avatar" />
                      <strong>{c.user_login}</strong>
                      <span style={{ color: "var(--text3)" }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <div className="docs-content" style={{ marginTop: 6, padding: "8px 12px" }}>
                      <ReactMarkdown>{c.body}</ReactMarkdown>
                    </div>
                  </div>
                ))}

                <div className="ghub-comment-form">
                  <textarea className="ghub-comment-input" placeholder="Write a comment…"
                    value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                    rows={3} />
                  <button className="btn btn-primary" onClick={handlePostComment}
                    disabled={posting || !commentBody.trim()}>
                    {posting ? "Posting…" : "Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GitHubHubPage;
