# Devlog

## 2026-04-14 — v1.0.0: Initial Release

Converted the browser-based song lyrics prompter (`Промптер для текстов песен.html`) into a standalone Tauri v2 desktop app.

### What was done

- Scaffolded Tauri v2 project (vanilla JS frontend, Rust backend)
- Extracted CSS, LTC decoder, and i18n from the original single-file HTML
- Wrote Rust backend with 7 commands: monitor listing, viewer window creation, auto-save/load, native file dialogs (save/open project, import TXT)
- Ported ~1200 lines of main window JS with Tauri integration:
  - `window.open` + `postMessage` replaced with Tauri `WebviewWindow` + `emitTo`/`listen`
  - File inputs replaced with native OS dialogs via `rfd` crate
  - Added auto-save (debounced 500ms) and auto-load on startup
  - Fullscreen via native `setFullscreen` instead of browser API
  - Second screen opens on selected monitor in fullscreen
- Created viewer window JS (160 lines) for second-screen display
- Set up GitHub Actions CI for macOS (ARM + Intel) and Windows builds
- Published v1.0.0 release with .dmg (3.3 MB), .exe (1.9 MB), .msi (2.8 MB)

### Features (1:1 parity with original)

- Song list management (add, delete, reorder, rename)
- Auto-scrolling lyrics (by speed or duration)
- Per-song display settings (font size, line height, width, alignment)
- Second screen with monitor selection, fullscreen, scroll sync
- SMPTE LTC timecode decoder from audio input
- Timeline markers (start, pause, speed change by timecode)
- Song triggers (auto-switch by timecode)
- Urgent messages to second screen
- Project export/import (JSON), TXT import
- Localization RU/EN
- Keyboard shortcuts (Space, Enter, F)
- Played/unplayed tracking with color-coded viewer song list

### Technical decisions

- **Tauri v2 over Electron** — 3.3 MB app vs ~150 MB; native system WebView
- **No bundler** — vanilla JS with script tags; keeps it simple, matches original approach
- **`rfd` crate over `tauri-plugin-dialog`** — simpler API for sync file dialogs
- **Auto-save to app data dir** — original had no persistence; now state survives restarts
- **Identifier changed** from `com.song-prompter.app` to `com.songprompter.desktop` — `.app` suffix conflicted with macOS bundle extension

### Build sizes

| Platform | Format | Size |
|----------|--------|------|
| macOS ARM | .dmg | 3.3 MB |
| macOS Intel | .dmg | 3.4 MB |
| Windows | .exe | 1.9 MB |
| Windows | .msi | 2.8 MB |
