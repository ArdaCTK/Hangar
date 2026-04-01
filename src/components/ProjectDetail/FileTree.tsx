import React, { useState } from "react";
import type { FileNode } from "../../types";
import { openInExplorer } from "../../lib/tauri";

const FILE_ICONS: Record<string, string> = {
  ts: "🔷", tsx: "⚛️", js: "🟡", jsx: "⚛️",
  rs: "🦀", py: "🐍", go: "🐹", cs: "🟣",
  kt: "🟣", java: "☕", cpp: "🔵", c: "🔵", h: "🔵",
  html: "🌐", css: "🎨", scss: "🎨", json: "📋",
  toml: "⚙️", yaml: "⚙️", yml: "⚙️", md: "📝",
  txt: "📄", env: "🔑", gitignore: "👻",
  png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️", ico: "🖼️",
  pdf: "📕", zip: "📦", tar: "📦", gz: "📦",
  sh: "💻", bat: "💻", ps1: "💻",
  lock: "🔒", sum: "🔒",
};

function getIcon(node: FileNode): string {
  if (node.is_dir) return "📁";
  const ext = node.extension?.toLowerCase() ?? "";
  // special filenames
  if (node.name === ".env" || node.name.startsWith(".env.")) return "🔑";
  if (node.name === "Dockerfile") return "🐳";
  return FILE_ICONS[ext] ?? "📄";
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

interface NodeProps {
  node: FileNode;
  depth?: number;
}

const FileNodeItem: React.FC<NodeProps> = ({ node, depth = 0 }) => {
  const [open, setOpen] = useState(depth < 2 && node.is_dir);

  const handleClick = () => {
    if (node.is_dir) setOpen((o) => !o);
  };

  const handleDoubleClick = () => {
    openInExplorer(node.path).catch(() => {});
  };

  return (
    <div className="file-node">
      <div
        className="file-node-row"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title={node.path + (node.is_dir ? "" : " — double-click to reveal in Explorer")}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        <span className={`file-icon ${node.is_dir ? "dir-icon" : ""}`}>
          {node.is_dir ? (open ? "📂" : "📁") : getIcon(node)}
        </span>
        <span className="file-name">{node.name}</span>
        {!node.is_dir && node.size > 0 && (
          <span className="file-size">{formatSize(node.size)}</span>
        )}
      </div>

      {node.is_dir && open && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FileNodeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

interface Props {
  nodes: FileNode[];
  loading?: boolean;
}

const FileTree: React.FC<Props> = ({ nodes, loading }) => {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Loading file tree…</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="docs-empty">
        <div style={{ fontSize: "24px" }}>📁</div>
        <div style={{ color: "var(--text3)" }}>Directory is empty</div>
      </div>
    );
  }

  return (
    <div
      className="file-tree"
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "6px 0",
        maxHeight: "65vh",
        overflowY: "auto",
      }}
    >
      {nodes.map((n) => (
        <FileNodeItem key={n.path} node={n} depth={0} />
      ))}
    </div>
  );
};

export default FileTree;
