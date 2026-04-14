# Devlog

## 2026-04-14 — v1.0.0 + hotfixes

### Initial build

Converted the browser-based song lyrics prompter (`Промптер для текстов песен.html`) into a standalone Tauri v2 desktop app "Mini Prompter Lunia".

**Features (1:1 parity with original + improvements):**
- Song list management (add, delete, reorder, rename)
- Auto-scrolling lyrics (by speed or duration)
- Per-song display settings (font size, line height, width, alignment)
- Second screen with auto monitor detection, native fullscreen, scroll sync
- SMPTE LTC timecode decoder from audio input
- Timeline markers (start, pause, speed change by timecode)
- Song triggers (auto-switch by timecode)
- Urgent messages to second screen
- Project export/import (JSON)
- Import TXT and DOCX files (new: DOCX support via zip crate)
- Fullscreen lyrics editor overlay (new: "Редактор" button)
- Auto-save / auto-load on startup (new: data persists across restarts)
- Localization RU/EN
- Keyboard shortcuts (Space, Enter, F, Esc)
- Played/unplayed tracking with color-coded viewer song list
- Resizable right sidebar (250-600px)

### Hotfixes applied same day

1. **Bundle identifier** — changed from `com.song-prompter.app` to `com.songprompter.desktop` (`.app` suffix conflicted with macOS bundle extension, DMG packaging failed)

2. **macOS fullscreen Space issue** — pressing F on main window was fullscreening BOTH windows, creating a macOS Space that hid the main window behind black. Fix: F on main only toggles viewer fullscreen. Viewer enters native fullscreen via JS on open.

3. **Monitor detection** — viewer was opening on the main monitor instead of the secondary. Fix: `list_monitors` now returns `is_main` flag per monitor (checks if main window position is within monitor bounds). JS auto-picks the first non-main monitor.

4. **Sidebar layout broken** — `direction: rtl` CSS hack for resize handle broke flex layout, sidebars disappeared. Fix: removed hack, added `flex-shrink: 0` to both sidebars.

5. **DOCX import** — added `.docx` support via `zip` crate. Extracts text from `word/document.xml` `<w:t>` tags. File dialog now accepts `.txt`, `.docx`, `.doc`.

6. **Fullscreen lyrics editor** — added "Редактор" button next to "Обновить текст". Opens fullscreen overlay with large textarea (`calc(100vh - 100px)`). Had to override global `textarea { max-height: 180px }` rule.

7. **Viewer background** — was `#050505` (dark gray), changed to `#000` (pure black) in viewer-mode CSS.

8. **Scroll sync between screens** — multiple iterations:
   - v1: pixel-based `scrollTop` — completely wrong at different resolutions
   - v2: fraction of scroll range `scrollTop / (scrollHeight - clientHeight)` — drifted because padding differed
   - v3: fraction with matching bottom padding on viewer — still drifted because container widths differed (text wraps differently)
   - v4: send exact `containerWidthPx` from main + text-height ratio `scrollTop / lyricsText.offsetHeight` — closest but may still have minor drift at end of long texts

### Technical decisions

- **Tauri v2 over Electron** — 3.3 MB app vs ~150 MB
- **No bundler** — vanilla JS, matches original approach
- **`rfd` crate** — simpler than `tauri-plugin-dialog` for sync file dialogs
- **`zip` 0.6** — v2 requires `time >= 0.3.37` which needs Rust 1.88; pinned to 0.6 for 1.87 compat
- **Native fullscreen only on viewer** — avoids macOS Spaces conflict with main window
- **Text-height scroll ratio** — resolution-independent sync between screens

### Build sizes

| Platform | Format | Size |
|----------|--------|------|
| macOS ARM | .dmg | 3.5 MB |
| macOS Intel | .dmg | 3.4 MB |
| Windows | .exe | 1.9 MB |
| Windows | .msi | 2.8 MB |

### Repo

https://github.com/alekseich91-cell/song-prompter
