# Project Dashboard

A local Windows 11 desktop app built with **Tauri 2 + Rust + React 18 + TypeScript**.

Scans your Projects folder and gives you a unified dashboard with GitHub integration, dependency analysis, file trees, docs viewer, and API connection detection.

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Rust (stable)](https://rustup.rs/)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)
  ```
  cargo install tauri-cli --version "^2"
  ```
- Microsoft Visual Studio C++ Build Tools (Windows)
- WebView2 Runtime (included in Windows 11 by default)

---

## Setup

```bash
# 1. Install frontend dependencies
npm install

# 2. Run in development mode
npm run tauri dev

# 3. Build for production
npm run tauri build
```

The built installer will be in `src-tauri/target/release/bundle/`.

---

## First Launch

1. A **Settings** modal will appear automatically.
2. Click **Browse** to select your `Projects` folder (e.g., `C:\Users\You\Desktop\Projects`).
3. Optionally add a **GitHub Personal Access Token** for private repos and higher API rate limits.
   - Required scopes: `repo`, `read:user`
   - Generate at: https://github.com/settings/tokens
4. Click **Save & Scan** — the app will scan all subdirectories.

---

## Features

### Dashboard
- Summary stats: total projects, git-connected, no-git, file count, dependencies, disk usage
- Language distribution donut chart
- Framework & ecosystem horizontal bar chart
- Project cards grid with language tags, type badge, git status

### Per-Project View (7 tabs)
| Tab | Contents |
|-----|----------|
| **Overview** | Quick stats, last commit, remote URL, frameworks |
| **Git / GitHub** | Local branches + commit log; GitHub stars/forks/issues/PRs/topics |
| **Files** | Interactive file tree (expandable, double-click to open in Explorer) |
| **Dependencies** | All npm/cargo/pip/go deps with filtering by ecosystem |
| **Docs** | README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT rendered as Markdown |
| **APIs** | Detected API keys and SDK usage from .env files and package.json |

---

## Supported Language Detection

TypeScript, JavaScript, Rust, Python, C#, Go, Kotlin, Java, Swift, C++, C, HTML, CSS, SCSS, Vue, Svelte, Dart, Ruby, PHP, Lua, Zig, Elixir, F#, R, Shell, PowerShell, SQL

## Supported Framework Detection

Tauri, Vite, Next.js, Nuxt, SvelteKit, Remix, Astro, Angular, Gatsby, Expo, React Native, React, Electron, Node.js API, tRPC, Rust/Cargo, Python/Poetry, Python/pip, Go Module, Maven, Gradle, CMake, Docker, Docker Compose, Terraform, GitHub Actions, Unity, Android, iOS/macOS

---

## Settings Location

Settings are stored at:
```
%APPDATA%\project-dashboard\settings.json
```
