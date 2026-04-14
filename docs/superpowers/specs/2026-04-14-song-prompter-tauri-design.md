# Song Prompter — Tauri Desktop Application

**Date:** 2026-04-14
**Source:** `/Users/lunia/Downloads/Промптер для текстов песен.html` (~2500 lines, single HTML file)
**Goal:** Convert the browser-based song lyrics prompter into a standalone Tauri v2 desktop application for macOS and Windows.

## Scope

Exact 1:1 feature parity with the original HTML prompter. Technical improvements only — no new features, no removed features.

### Features (preserved from original)

- Song list management (add, delete, reorder, rename)
- Lyrics display with auto-scrolling (by speed or by duration)
- Display settings per song (font size, line height, text width, text alignment)
- Second screen (viewer) for stage display
- LTC decoder — SMPTE Linear Timecode from audio input (Manchester-encoded)
- Timeline markers per song (start, pause, speed change at timecodes)
- Song triggers (auto-switch songs at timecodes)
- Urgent messages to second screen (30s display)
- Project export/import (JSON)
- TXT import (single or multiple files)
- Fullscreen mode (F key, also А on Russian keyboard layout)
- Localization RU/EN
- Keyboard shortcuts (Space=pause/resume, Enter=start — main window only; F/А=fullscreen — both windows)
- Played/unplayed song tracking with color coding on viewer
- "Reset played" button to clear all played marks
- "Love note" footer ("С любовью из России" / "With Love From Russia"), localized

### Removed from original

- `#homeLink` — link to external website (not applicable in standalone app)
- Hidden `<input type="file">` elements — replaced by Tauri native file dialogs

### Technical improvements (not visible to user as new features)

| Original (HTML) | Tauri |
|---|---|
| `window.open` + `postMessage('*')` | `WebviewWindow` + Tauri event system (`emit`/`listen`) |
| No data persistence | Auto-save to `~/.song-prompter/last-project.json` on every change |
| No project management | Native file dialogs for "Open Project" / "Save Project As..." |
| `navigator.mediaDevices` only | Tauri command to list monitors; `getUserMedia` for audio capture |
| `document.requestFullscreen` | `set_fullscreen(true)` with monitor selection |
| Hardcoded audio device list in saved HTML | Dynamic enumeration at runtime |
| Same HTML for both windows (`?viewer=1` param) | Separate `index.html` and `viewer.html` |

### Not persisted (same as original)

- `currentLang` — language selection is not saved to project file
- `showSongListOnViewer` — checkbox state is not saved to project file

## Data model

### Song object (`defaultSong()`)

```js
{
  id: String,              // Generated: Date.now() + '_' + Math.random().toString(16).slice(2)
  title: String,           // Default: 'Песня ' + songCounter++ (auto-incrementing)
  text: String,            // Default: ''
  fontSize: Number,        // Default: 32, range: 16–72, step: 2
  lineHeight: Number,      // Default: 0.8, range: 0.1–2.5 (UI slider: 1–25, mapped via value/10)
  textWidthPercent: Number, // Default: 100, range: 40–100, step: 5
  textAlign: String,       // Default: 'center', options: 'center' | 'left'
  scrollMode: String,      // Default: 'speed', options: 'speed' | 'duration'
  speed: Number,           // Default: 30 px/s, range: 1–400, step: 1
  durationSeconds: Number, // Default: 0, parsed from 'mm:ss' or plain seconds
  played: Boolean,         // Default: false
  markers: Array           // Default: [], timeline markers (see below)
}
```

**Runtime-only fields (not persisted):**
- `_lastTriggeredIndex: Number` — tracks which timeline markers have fired, reset to `-1` on song selection

### Timeline marker

```js
{
  type: String,   // 'start' | 'pause' | 'change'
  time: Number,   // Timecode in seconds
  speed: Number   // Only for 'start' and 'change' types, px/s
}
```

Markers are sorted by time on each render.

### Song trigger

```js
{
  time: Number,       // Timecode in seconds when trigger fires
  songIndex: Number,  // Index of song to switch to
  _triggered: Boolean // Runtime flag, prevents re-firing. Reset by resetTriggerStates()
}
```

Triggers sorted by time on each render. `_triggered` is stripped during export.

### Project file format (version 3)

```json
{
  "version": 3,
  "selectedSongIndex": 0,
  "songs": [ /* song objects */ ],
  "songTriggers": [ { "time": 0, "songIndex": 0 } ]
}
```

Export filename: `song_prompter_project.json`. On import, each song is merged with `defaultSong()` defaults via spread (`{...defaultSong(), ...imported}`). `songCounter` is set to `songs.length + 1` after import.

### `songCounter` global

Auto-incrementing counter for default song titles. Starts at 1, incremented on each `defaultSong()` call.

## Architecture

### Technology stack

- **Tauri v2** — app shell, window management, file system, IPC
- **Rust** — backend commands (file I/O, monitor enumeration)
- **Vanilla JS** — frontend, no frameworks, no bundler
- **HTML/CSS** — from original, adapted for two separate pages

### Project structure

```
song-prompter/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Entry point, app setup
│   │   ├── lib.rs            # Tauri command registration
│   │   └── commands.rs       # Tauri commands (files, monitors)
│   ├── Cargo.toml
│   ├── tauri.conf.json       # Window config, permissions
│   └── icons/                # App icons
├── src/
│   ├── index.html            # Main window markup
│   ├── viewer.html           # Viewer window markup
│   ├── styles.css            # All styles (from original)
│   ├── app.js                # Main window logic
│   ├── viewer.js             # Viewer window logic
│   ├── ltc-decoder.js        # LTC decoder (SimpleEventEmitter, Frame, Decoder)
│   └── i18n.js               # Localization strings and update function
└── package.json              # Tauri CLI dev dependency only
```

### Module breakdown

**`ltc-decoder.js`** — Extracted from original lines 782–946. Contains `SimpleEventEmitter`, `Frame`, and `Decoder` classes. Zero changes to logic. Exported for use in `app.js`.

**`i18n.js`** — Extracted from original lines 1687–1852. Contains translation strings as a dictionary object and `updateUITexts(lang)` function. The original uses direct DOM manipulation with `document.getElementById()` and manual text setting — this approach is preserved (no `data-i18n` attributes). The dictionary replaces if/else chains but the DOM update mechanism stays the same.

**`app.js`** — Main application logic. Contains song management, scroll engine, marker/trigger logic, audio input handling. Replaces `window.open` with Tauri `WebviewWindow`, replaces `postMessage` with `emit`/`listen`, adds auto-save calls, adds native file dialog calls.

**`viewer.js`** — Viewer window logic. Listens for Tauri events instead of `window.addEventListener('message')`. Handles song display, scroll sync, urgent messages, fullscreen, fullscreen hint, viewer song list rendering. Only handles F/А keyboard shortcut (no Space/Enter).

**`styles.css`** — All CSS from original, unchanged. Both `index.html` and `viewer.html` reference it.

## Component design

### Window management

**Main window:** Opens on launch with the three-panel layout (song list | lyrics | controls). Size: 1200x800 default, resizable. Label: `"main"`.

**Viewer window:** Created via Tauri `WebviewWindow` when user clicks "Second screen". Label: `"viewer"`. Flow:
1. User clicks "Второй экран" / "Second screen"
2. If viewer already open: focus it, return
3. Rust command `list_monitors` returns available monitors with labels
4. If >1 monitor: show a selection dialog (simple dropdown or list)
5. If 1 monitor: open on that monitor
6. Viewer opens fullscreen on the selected monitor with `viewer.html`
7. Main window gets class `two-window-mode` (CSS: `#center { max-height: unset }`)

When viewer is closed (detected in `syncToViewer()`): remove `two-window-mode` class, set `viewerWindow = null`.

**Fullscreen hint on viewer:** A pulsing blue button (#fullscreenHint) that says "Нажмите F для полноэкранного режима" / "Press F for fullscreen mode". Shown only in viewer-mode when NOT fullscreen. Clickable to enter fullscreen. Hidden when fullscreen is active (via `is-fullscreen` class on body, toggled by `fullscreenchange` event). Text is language-aware (updated from main window's lang).

### IPC between windows (Tauri events)

Replaces `postMessage('*')` with Tauri `emit_to` / `listen`. All 7 message types from original:

| Direction | Event name | Payload | Description |
|---|---|---|---|
| Main → Viewer | `update-song` | `{text, style: {fontSize, lineHeight, widthPercent, textAlign}, scrollTop, showSongList, songList: [{title, played, isCurrent}], lang}` | Full song state sync |
| Main → Viewer | `scroll` | `{scrollTop}` | Scroll position sync (on every scroll, including manual) |
| Main → Viewer | `urgent-message` | `{text, duration: 30000}` | Show urgent message (duration hardcoded 30s) |
| Main → Viewer | `hide-urgent` | — | Hide urgent message |
| Main → Viewer | `enter-fullscreen` | — | Request fullscreen (may not work without user gesture) |
| Main → Viewer | `exit-fullscreen` | — | Request exit fullscreen |
| Viewer → Main | `viewer-ready` | — | Viewer loaded, triggers initial sync |

### Data persistence

**Auto-save:** On every state change (song edit, settings change, song reorder), debounced 500ms, write to `~/.song-prompter/last-project.json`. Same JSON format as project export (version 3).

**Manual save/load:**
- "Export project" → Tauri `dialog::save_file` → write JSON to chosen path
- "Import project" → Tauri `dialog::open_file` filter `*.json` → read, parse, merge with defaults, reset triggers, start timecode
- "Import TXT" → Tauri `dialog::open_file` filter `*.txt`, multiple selection → read files

**TXT import behavior:**
- **Single file:** Imports into the currently selected song (replaces text, resets `played = false`, resets scroll to top)
- **Multiple files:** Creates a new song for each file, uses filename (without extension) as song title, selects the first newly created song after all files load

**Startup:** Load `last-project.json` if it exists. If not, create default single-song state.

### Song deletion edge case

When only one song remains, clicking "Delete song" does NOT delete it — it clears the song to `defaultSong()` defaults instead. This ensures the song list is never empty.

### Played marking logic

A song is marked `played = true` when:
- `startScroll()` is called (explicit start or via marker/trigger)
- Switching to another song IF `scrollTop > 0` or already marked played

A song is marked `played = false` when:
- "Apply lyrics" button is clicked (updating text resets played status)
- Single TXT file is imported into the song
- New song is created (default)

All played flags reset via "Reset played" button.

### LTC decoder

Unchanged from original. The `Decoder` class processes PCM float samples from `AnalyserNode` and emits `frame` events. Audio capture uses `navigator.mediaDevices.getUserMedia` — this works in Tauri's WebView. Device enumeration via `navigator.mediaDevices.enumerateDevices`.

**Audio input enumeration retry logic:** `populateAudioInputs(retry=true)` — if no devices found or labels are empty, requests `getUserMedia({audio: true})`, stops the stream immediately, then retries with `retry=false`. This handles browsers/WebViews that hide device labels until permission is granted.

**Audio input change:** When audio input select changes, `startTimecode()` is called, which:
1. Clears previous interval
2. Resets `timecodeCurrentSeconds` and `timecodeLastFrameTimestamp` to 0
3. Calls `resetTriggerStates()`
4. Closes previous `audioContext`, stops previous `audioStream` tracks
5. Sets clock to '—' (em dash)
6. Creates new `AudioContext`, `AnalyserNode` (fftSize=2048), `Decoder`
7. Starts `setInterval(40ms)` to feed samples to decoder

**No-frame detection:** If no LTC frame decoded in 500ms, clock shows '—'.

**Timecode parsing (`parseTimecode`):** Supports 1–4 colon-separated parts:
- 4: `HH:MM:SS:FF` (frames divided by fps)
- 3: `HH:MM:SS`
- 2: `MM:SS`
- 1: plain seconds

**Duration parsing (`parseDuration`):** Supports `mm:ss` or plain seconds.

### Scroll engine

Unchanged from original. `requestAnimationFrame` loop with fractional pixel accumulator.

**Speed calculation (`getEffectiveSpeed`):**
- Speed mode: `song.speed` (px/s)
- Duration mode: `lyricsText.scrollHeight - lyricsContainer.clientHeight` / `song.durationSeconds` (if totalHeight <= 0, fallback to 30)

**Scroll step:** Each frame: `scrollAccumulator += speed * delta`. Only whole pixels are applied: `pixels = Math.floor(scrollAccumulator)`, remainder carried forward. This ensures smooth scrolling at low speeds.

**Bottom padding:** `applyExtraBottomPadding()` sets `lyricsText.paddingBottom` to `Math.floor(containerHeight / 2) + 'px'`. Called on scroll start and during init. Allows scrolling past the last lines of text.

**`pauseScroll` vs `stopScroll`:**
- `pauseScroll()`: stops animation, scroll position preserved
- `stopScroll()`: calls `pauseScroll()`, then resets `scrollTop` to 0, syncs viewer to 0

**"To top" button:** Sets `scrollTop = 0` and syncs viewer, but does NOT stop scrolling. If scroll is active, it continues from the top.

**Manual scroll sync:** `lyricsContainer` has a `scroll` event listener that sends scroll position to viewer on ANY scroll event (programmatic or manual user scrolling).

### Keyboard shortcuts

**Main window:**

| Key | Action |
|---|---|
| Space | Pause/resume scroll (toggle) |
| Enter | Start scroll |
| F / f / А / а | Toggle fullscreen |

**Viewer window:**

| Key | Action |
|---|---|
| F / f / А / а | Toggle fullscreen |

All keyboard shortcuts are suppressed when focus is in an `<input>` or `<textarea>` (`isEditingElement()` check).

Russian А/а is the same physical key as F on a Russian keyboard layout.

### Timeline markers behavior

**`checkTimecodeMarkers()`:** Uses sequential `_lastTriggeredIndex` tracking per song. Iterates from `_lastTriggeredIndex + 1` forward. For each marker where `timecodeCurrentSeconds >= marker.time`:
- `start`: sets `song.speed` to marker's speed, updates UI slider/label, calls `startScroll()`
- `pause`: calls `pauseScroll()`
- `change`: sets `song.speed` to marker's speed, updates UI slider/label, does NOT start/pause — new speed applies automatically if already scrolling

**Adding markers:** "Add start/pause/speed" buttons pre-fill `timecodeCurrentSeconds` as the default time.

### Song triggers behavior

**`checkSongTriggers()`:** Iterates all triggers. For each where `!_triggered && timecodeCurrentSeconds >= trigger.time`:
1. Sets `_triggered = true`
2. Calls `selectSong(idx)` (which stops current scroll, may mark current song as played)
3. Resets `_lastTriggeredIndex = -1` on the newly selected song
4. Calls `startScroll()`

**`resetTriggerStates()`:** Sets `_triggered = false` on all triggers. Called on timecode restart and project import.

### Localization

Translation strings moved from inline if/else to a dictionary object:

```js
const translations = {
  ru: { songs: 'Песни', addSong: 'Добавить песню', ... },
  en: { songs: 'Songs', addSong: 'Add song', ... }
};
```

`updateUITexts()` uses direct DOM manipulation with `document.getElementById()` — same approach as original. No `data-i18n` attributes. The dictionary replaces the if/else chains but the update mechanism is preserved.

### Urgent messages

- Main window: textarea input + "Send" button + "Hide" button
- Sends to viewer with hardcoded 30000ms (30s) duration
- Viewer shows `#urgentMessageDisplay` overlay (fixed, top, red background with pulse animation, font-size 36px)
- Auto-hides after duration via `setTimeout`
- "Hide" button sends `hide-urgent` event to clear immediately

### CSS states

| Class | Applied to | Trigger |
|---|---|---|
| `active` | `.song-item` | Currently selected song in main list |
| `played` | `.song-item` | Song marked as played in main list |
| `viewer-mode` | `body` | Viewer window (hides sidebars, expands center) |
| `show-song-list` | `body` | Viewer mode with song list visible |
| `is-fullscreen` | `body` | Viewer in fullscreen (hides fullscreen hint) |
| `two-window-mode` | `body` | Main window when viewer is open |
| `align-left` | `#lyricsText` | Left alignment (width: fit-content, centered block, left-aligned text) |
| `pending` | `.viewer-song-item` | Green (#4ade80), left border green |
| `current` | `.viewer-song-item` | Red (#ef4444), bg #1a0a0a, bold |
| `played` | `.viewer-song-item` | Gray (#6b7280), opacity 0.7 |

### Viewer song list

Items rendered as `"1. Song Title"`, `"2. Song Title"` etc. (numbered). Color-coded by status (see CSS states above).

### Initialization sequence

1. Create first song (`createNewSong()`)
2. Render song list
3. Load song into UI
4. Apply extra bottom padding
5. Populate audio inputs (with retry logic)
6. Start timecode
7. Update UI texts (localization)
8. Render triggers

## Tauri commands (Rust)

```rust
#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<MonitorInfo>
// Returns list of available monitors with name, size, position

#[tauri::command]
fn open_viewer_on_monitor(app: AppHandle, monitor_index: usize) -> Result<(), String>
// Creates viewer window on specified monitor in fullscreen

#[tauri::command]
fn auto_save(app: AppHandle, data: String) -> Result<(), String>
// Writes JSON string to ~/.song-prompter/last-project.json

#[tauri::command]
fn auto_load(app: AppHandle) -> Result<Option<String>, String>
// Reads ~/.song-prompter/last-project.json, returns None if doesn't exist

#[tauri::command]
fn save_project_dialog(app: AppHandle, data: String) -> Result<(), String>
// Opens native save dialog, writes JSON to chosen path

#[tauri::command]
fn open_project_dialog(app: AppHandle) -> Result<Option<String>, String>
// Opens native open dialog for .json, returns file contents

#[tauri::command]
fn import_txt_dialog(app: AppHandle) -> Result<Vec<TxtFile>, String>
// Opens native open dialog for .txt (multiple), returns Vec<{name, content}>
```

## Tauri configuration

**`tauri.conf.json`** key settings:
- `identifier`: `com.song-prompter.app`
- `productName`: `Song Prompter`
- Main window: `label: "main"`, `width: 1200`, `height: 800`, `resizable: true`
- Viewer window: created dynamically (not in config)
- Permissions: `fs` (app data dir), `dialog` (open/save), `window` (create, fullscreen, monitors), `event` (emit/listen)

## Build targets

- **macOS:** `.dmg` installer via `tauri build`
- **Windows:** `.msi` or `.exe` installer via `tauri build` (requires cross-compilation or Windows CI)

## Error handling

- File read/write errors: show native dialog with error message
- Audio device unavailable: show '—' (em dash) in timecode clock (same as original)
- Viewer window fails to open: log error, button remains clickable for retry
- Invalid project JSON on import: show alert (same as original), check `Array.isArray(json.songs)`
- Import merges with `defaultSong()` defaults, ensures at least one song exists, clamps `selectedSongIndex`

## Testing

Manual testing checklist:
- Songs: add, delete (including last-song-clear edge case), reorder, rename, import TXT (single into current + multiple as new songs)
- Scroll: start, pause, resume, stop (resets to top), "To top" (doesn't stop scroll), speed mode, duration mode
- Display: font size (16–72), line height (0.1–2.5), text width (40–100%), alignment (center/left) — all reflected on viewer
- Second screen: monitor selection, fullscreen, scroll sync (including manual scroll), urgent messages (send + auto-hide 30s + manual hide), fullscreen hint
- LTC: audio input selection (with retry enumeration), timecode display, 500ms no-frame detection, markers (start/pause/change), triggers (auto-switch + auto-start)
- Persistence: auto-save on change, restore on restart, export/import project (verify merge with defaults)
- Localization: switch RU/EN, all labels update including viewer fullscreen hint
- Keyboard: Space+Enter in main window only, F/А in both windows, suppressed in input/textarea
- Played status: marked on scroll start, marked on song switch if scrolled, reset on text update, reset on TXT import, reset all button
- Edge cases: viewer re-focus on second click, language not persisted, showSongList not persisted
