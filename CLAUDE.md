# Mini Prompter Lunia

Standalone desktop teleprompter for song lyrics. Built with Tauri v2 (Rust + vanilla JS).
Repo: https://github.com/alekseich91-cell/song-prompter

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
  app.js              # Main window logic (~1250 lines)
  viewer.js           # Viewer logic (~170 lines)
  ltc-decoder.js      # SMPTE LTC timecode decoder
  i18n.js             # RU/EN translations
  styles.css          # All styles

src-tauri/            # Rust backend
  src/commands.rs     # Tauri commands (file I/O, dialogs, monitors, DOCX parse)
  src/lib.rs          # App setup, command registration, window events
  src/main.rs         # Entry point
```

## Architecture

- **No bundler** — vanilla JS with `<script>` tags, globals shared between files
- **`withGlobalTauri: true`** — Tauri API available as `window.__TAURI__` (invoke, emitTo, listen, getCurrentWindow)
- **IPC** — main window and viewer communicate via Tauri events (`emitTo`/`listen`), not `postMessage`
- **Scroll sync** — uses `scrollTop / lyricsText.offsetHeight` ratio (text-relative, resolution-independent)
- **Viewer width** — receives exact `containerWidthPx` from main window so text wraps identically
- **File dialogs** — native via `rfd` crate in Rust, called through `invoke()`
- **DOCX import** — parsed in Rust via `zip` crate, extracts text from `word/document.xml`
- **Auto-save** — debounced 500ms to app data dir (`last-project.json`)

## Key Conventions

- All JS uses `var` and `function` (ES5 style), no modules
- Translation keys ending in `Html` (e.g. `durationNoteHtml`) contain trusted hardcoded HTML and use `innerHTML`; all others use `textContent`
- Viewer window label is `"viewer"`, main is `"main"` — used in `emitTo` targeting
- Rust command parameter names are snake_case; JS sends camelCase (Tauri auto-converts)
- Viewer enters native fullscreen via JS after opening (not via Rust `.fullscreen(true)` which caused macOS Space conflicts)
- Monitor detection: `list_monitors` returns `is_main` flag per monitor; JS auto-picks the other one

## Known Issues / Active Work

- Scroll sync between screens may still drift slightly at end of long texts — uses text-height-ratio approach but padding differences remain
- Right sidebar resizable via CSS `resize: horizontal` (handle at bottom-right corner)
- Fullscreen lyrics editor opens via "Редактор" button, Esc to close

## Build & Release

CI via GitHub Actions (`.github/workflows/build.yml`):
- Push a tag `v*` to trigger builds for macOS (ARM + Intel) and Windows
- Builds create a draft release with `.dmg`, `.exe`, `.msi` artifacts
- Publish the draft release on GitHub: `gh release edit <tag> --draft=false`

## Dependencies

- **Rust:** tauri 2, rfd (file dialogs), zip 0.6 (DOCX parsing), serde, serde_json
- **Node:** @tauri-apps/cli (dev only)
- **No frontend dependencies**
- **Rust 1.87 compat:** `time` crate pinned to 0.3.36 (newer requires 1.88)
