import React, { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen } from "@tauri-apps/api/event";
import { terminalRun, terminalKill, getProjectScripts } from "../../lib/tauri";
import type { ScriptInfo } from "../../types";
import "@xterm/xterm/css/xterm.css";

interface Props {
  projectPath: string;
  projectName: string;
}

let termCounter = 0;

const Terminal: React.FC<Props> = ({ projectPath, projectName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<XTerm | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const termIdRef    = useRef<string>(`term-${++termCounter}`);
  const unlistenRef  = useRef<(() => void)[]>([]);

  const [scripts, setScripts]       = useState<ScriptInfo[]>([]);
  const [running, setRunning]       = useState(false);
  const [currentCmd, setCurrentCmd] = useState<string | null>(null);
  const [cmdInput, setCmdInput]     = useState("");

  // Init xterm
  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      theme: {
        background:   "#080808",
        foreground:   "#e0e0e0",
        cursor:       "#e0e0e0",
        black:        "#1a1a1a",
        brightBlack:  "#444444",
        red:          "#e05c5c",
        brightRed:    "#ff6b6b",
        green:        "#5cba7d",
        brightGreen:  "#6dd98f",
        yellow:       "#e8b84b",
        brightYellow: "#ffd166",
        blue:         "#5b9cf6",
        brightBlue:   "#74b0ff",
        magenta:      "#a78bfa",
        brightMagenta:"#c4aeff",
        cyan:         "#4dd0e1",
        brightCyan:   "#67e8f9",
        white:        "#cccccc",
        brightWhite:  "#ffffff",
      },
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace",
      fontSize:   12,
      lineHeight: 1.4,
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
    });
    const fit   = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current  = fit;

    term.writeln("\x1b[90m─── Project Dashboard Terminal ───\x1b[0m");
    term.writeln(`\x1b[90mProject: \x1b[36m${projectName}\x1b[0m`);
    term.writeln(`\x1b[90mPath:    \x1b[90m${projectPath}\x1b[0m`);
    term.writeln("");

    const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Load scripts
  useEffect(() => {
    getProjectScripts(projectPath).then(setScripts).catch(() => {});
  }, [projectPath]);

  // Subscribe to tauri events when running
  const subscribeToEvents = useCallback(async (id: string) => {
    const unlisten1 = await listen<string>(`term-data-${id}`, (e) => {
      termRef.current?.write(e.payload);
    });
    const unlisten2 = await listen<number>(`term-exit-${id}`, (e) => {
      const code = e.payload;
      termRef.current?.writeln(`\r\n\x1b[90m─── Process exited with code ${code} ───\x1b[0m\r\n`);
      setRunning(false);
      setCurrentCmd(null);
    });
    unlistenRef.current = [unlisten1, unlisten2];
  }, []);

  const cleanupListeners = useCallback(() => {
    unlistenRef.current.forEach((u) => u());
    unlistenRef.current = [];
  }, []);

  const runCommand = useCallback(async (program: string, args: string[], label: string) => {
    if (running) return;
    cleanupListeners();
    setRunning(true);
    setCurrentCmd(label);
    const id = termIdRef.current;
    termRef.current?.writeln(`\x1b[90m$ \x1b[32m${label}\x1b[0m`);
    await subscribeToEvents(id);
    try {
      await terminalRun(id, projectPath, program, args);
    } catch (e) {
      termRef.current?.writeln(`\x1b[31mError: ${e}\x1b[0m`);
      setRunning(false);
      setCurrentCmd(null);
    }
  }, [running, projectPath, subscribeToEvents, cleanupListeners]);

  const kill = useCallback(async () => {
    await terminalKill(termIdRef.current).catch(() => {});
    cleanupListeners();
    termRef.current?.writeln("\r\n\x1b[33m─── Killed by user ───\x1b[0m\r\n");
    setRunning(false);
    setCurrentCmd(null);
  }, [cleanupListeners]);

  const handleCustomCmd = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !cmdInput.trim() || running) return;
    const parts = cmdInput.trim().split(/\s+/);
    runCommand(parts[0], parts.slice(1), cmdInput.trim());
    setCmdInput("");
  };

  const clearTerminal = () => { termRef.current?.clear(); };

  // Group scripts by ecosystem
  const grouped = scripts.reduce<Record<string, ScriptInfo[]>>((acc, s) => {
    (acc[s.ecosystem] = acc[s.ecosystem] ?? []).push(s);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Script buttons */}
      {Object.entries(grouped).map(([eco, items]) => (
        <div key={eco} className="section-block">
          <div className="section-block-title" style={{ marginBottom: 8 }}>
            {eco} scripts ({items.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {items.map((s) => (
              <button
                key={s.name}
                className="btn btn-ghost"
                style={{ fontSize: "11px", padding: "4px 10px", fontFamily: "var(--font-mono)", opacity: running ? 0.5 : 1 }}
                disabled={running}
                onClick={() => runCommand(s.program, s.args, s.command)}
                title={s.hint || s.command}
              >
                ▶ {s.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Terminal controls */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>$</span>
          <input
            className="form-input"
            style={{ paddingLeft: 22, fontFamily: "var(--font-mono)", fontSize: 12 }}
            placeholder={running ? `Running: ${currentCmd}…` : "Enter command…"}
            value={cmdInput}
            onChange={(e) => setCmdInput(e.target.value)}
            onKeyDown={handleCustomCmd}
            disabled={running}
          />
        </div>
        {running ? (
          <button className="btn" style={{ background: "rgba(224,92,92,0.15)", border: "1px solid rgba(224,92,92,0.3)", color: "var(--red)", padding: "7px 14px", fontSize: 12 }} onClick={kill}>
            ■ Kill
          </button>
        ) : (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={clearTerminal}>
            Clear
          </button>
        )}
      </div>

      {/* xterm container */}
      <div
        ref={containerRef}
        style={{
          background: "#080808",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          padding: "8px 4px 4px",
          minHeight: 340,
          height: 340,
          overflow: "hidden",
        }}
      />
    </div>
  );
};

export default Terminal;
