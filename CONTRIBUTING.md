# Contributing to Hangar

Thank you for your interest in contributing! Contributions are welcome and appreciated.

## Ways to Contribute

- 🐛 **Bug reports** — open an issue with steps to reproduce
- 💡 **Feature requests** — open an issue with your idea and use case
- 🔧 **Pull requests** — fix a bug, improve performance, or add a feature
- 📖 **Documentation** — improve the README or add examples

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the dev server:
   ```bash
   npm run tauri dev
   ```
5. Create a **feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```
6. Make your changes, then **commit** with a descriptive message:
   ```bash
   git commit -m "feat: add X feature"
   ```
7. Push and open a **Pull Request** against `main`.

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use for |
|--------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `perf:` | Performance improvement |
| `refactor:` | Code refactor without behaviour change |
| `docs:` | Documentation only |
| `style:` | Formatting, whitespace |
| `test:` | Tests |
| `chore:` | Build, deps, tooling |

## Code Style

- **Rust** — run `cargo fmt` and `cargo clippy` before committing
- **TypeScript/React** — consistent with existing code style; avoid unnecessary `any`
- **CSS** — use CSS variables from `index.css`, avoid inline colours

## Rust Commands

New Tauri commands follow the pattern in `src-tauri/src/commands/`:

1. Create a function with `#[tauri::command]`
2. Register it in `lib.rs` under `invoke_handler`
3. Add a typed wrapper in `src/lib/tauri.ts`
4. Add any new types to both `src/types/index.ts` and `src-tauri/src/models.rs`

## License

By contributing, you agree that your contributions will be licensed under the same [Hangar Personal Use License](LICENSE). You retain copyright of your contributions, but grant the project maintainer a perpetual licence to use them.

## Questions?

Open an issue or start a Discussion on GitHub. All questions are welcome.
