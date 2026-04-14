# Mini Prompter Lunia

Standalone desktop teleprompter for song lyrics. Built with Tauri v2 (Rust + vanilla JS).

## Quick Start

```bash
npm install
npx tauri dev      # development
npx tauri build    # production build
```

## Project Structure

```
src/                  # Frontend (vanilla JS, no bundler)
  index.html          # Main window (3-panel layout)
  viewer.html         # Second screen (viewer)
  app.js              # Main window logic (~1200 lines)
  viewer.js           # Viewer logic
  ltc-decoder.js      # SMPTE LTC timecode decoder
  i18n.js             # RU/EN translations
  styles.css          # All styles

src-tauri/            # Rust backend
  src/commands.rs     # Tauri commands (file I/O, dialogs, monitors)
  src/lib.rs          # App setup, command registration, window events
  src/main.rs         # Entry point
```

## Architecture

- **No bundler** — vanilla JS with `<script>` tags, globals shared between files
- **`withGlobalTauri: true`** — Tauri API available as `window.__TAURI__` (invoke, emitTo, listen, getCurrentWindow)
- **IPC** — main window and viewer communicate via Tauri events (`emitTo`/`listen`), not `postMessage`
- **File dialogs** — native via `rfd` crate in Rust, called through `invoke()`
- **Auto-save** — debounced 500ms to app data dir (`last-project.json`)

## Key Conventions

- All JS uses `var` and `function` (ES5 style), no modules
- Translation keys ending in `Html` (e.g. `durationNoteHtml`) contain trusted hardcoded HTML and use `innerHTML`; all others use `textContent`
- Viewer window label is `"viewer"`, main is `"main"` — these are used in `emitTo` targeting
- Rust command parameter names are snake_case; JS sends camelCase (Tauri auto-converts)

## Build & Release

CI via GitHub Actions (`.github/workflows/build.yml`):
- Push a tag `v*` to trigger builds for macOS (ARM + Intel) and Windows
- Builds create a draft release with `.dmg`, `.exe`, `.msi` artifacts
- Publish the draft release manually on GitHub

## Dependencies

- **Rust:** tauri 2, rfd (file dialogs), serde, serde_json
- **Node:** @tauri-apps/cli (dev only)
- **No frontend dependencies**
