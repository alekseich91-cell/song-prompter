# Song Prompter Tauri App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a browser-based song lyrics prompter (single HTML file) into a standalone Tauri v2 desktop app for macOS and Windows.

**Architecture:** Tauri v2 shell with vanilla JS frontend (no bundler, no framework). Rust backend handles file I/O, native dialogs, monitor enumeration, and window management. Frontend communicates via `invoke()` for commands and `emitTo()`/`listen()` for inter-window events. The `withGlobalTauri` config exposes the Tauri API as `window.__TAURI__`.

**Tech Stack:** Tauri v2, Rust, vanilla JS, HTML/CSS

**Source file:** `/Users/lunia/Downloads/Промптер для текстов песен.html`
**Spec:** `docs/superpowers/specs/2026-04-14-song-prompter-tauri-design.md`

**Note on innerHTML usage:** The original HTML prompter uses `.innerHTML` in several places for localized strings containing `<b>` tags (e.g., duration notes, fullscreen hints). These strings are hardcoded in `i18n.js` — not user-supplied — so there is no XSS risk. This pattern is preserved from the original for feature parity.

---

### Task 1: Scaffold Tauri v2 project

**Files:**
- Create: `package.json`
- Create: `src/index.html` (placeholder)
- Create: `src-tauri/` (via `tauri init`)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "song-prompter",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "tauri": "tauri"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd /Users/lunia/cld/prompt && npm install`
Expected: `node_modules/` created with `@tauri-apps/cli`

- [ ] **Step 3: Create placeholder frontend**

Create `src/index.html`:
```html
<!DOCTYPE html>
<html><head><title>Song Prompter</title></head>
<body><h1>Song Prompter</h1></body></html>
```

- [ ] **Step 4: Initialize Tauri**

Run: `cd /Users/lunia/cld/prompt && npx tauri init --app-name "Song Prompter" --window-title "Song Prompter" --frontend-dist ../src --ci`
Expected: `src-tauri/` directory created with `Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, `icons/`, `build.rs`

- [ ] **Step 5: Update tauri.conf.json**

Replace `src-tauri/tauri.conf.json` with:
```json
{
  "productName": "Song Prompter",
  "version": "1.0.0",
  "identifier": "com.song-prompter.app",
  "build": {
    "frontendDist": "../src",
    "beforeDevCommand": "",
    "beforeBuildCommand": ""
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "label": "main",
        "title": "Song Prompter",
        "width": 1200,
        "height": 800,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 6: Update Cargo.toml dependencies**

Replace `src-tauri/Cargo.toml` `[dependencies]` section:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rfd = "0.15"
```

Keep `[build-dependencies]` as generated (`tauri-build`).

- [ ] **Step 7: Create capabilities**

Create `src-tauri/capabilities/default.json`:
```json
{
  "identifier": "default",
  "description": "Song Prompter permissions",
  "windows": ["main", "viewer"],
  "permissions": [
    "core:default",
    "core:window:allow-create",
    "core:window:allow-set-fullscreen",
    "core:window:allow-is-fullscreen",
    "core:window:allow-set-focus",
    "core:window:allow-available-monitors",
    "core:window:allow-primary-monitor",
    "core:window:allow-close",
    "core:event:default",
    "core:webview:default"
  ]
}
```

- [ ] **Step 8: Verify Rust compiles**

Run: `cd /Users/lunia/cld/prompt/src-tauri && cargo check`
Expected: Compiles without errors (warnings about unused are OK)

- [ ] **Step 9: Commit**

```bash
git init
git add package.json package-lock.json src/index.html src-tauri/
git commit -m "feat: scaffold Tauri v2 project"
```

---

### Task 2: Rust backend — commands and app setup

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write commands.rs**

Create `src-tauri/src/commands.rs`:
```rust
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
}

#[derive(Serialize)]
pub struct TxtFile {
    pub name: String,
    pub content: String,
}

fn get_save_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
pub fn list_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    let monitors = main_window
        .available_monitors()
        .map_err(|e| e.to_string())?;

    Ok(monitors
        .iter()
        .map(|m| {
            let size = m.size();
            let pos = m.position();
            MonitorInfo {
                name: m.name().cloned().unwrap_or_default(),
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
            }
        })
        .collect())
}

#[tauri::command]
pub fn open_viewer_on_monitor(app: tauri::AppHandle, monitor_index: usize) -> Result<(), String> {
    if app.get_webview_window("viewer").is_some() {
        let viewer = app.get_webview_window("viewer").unwrap();
        viewer.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let main_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    let monitors: Vec<_> = main_window
        .available_monitors()
        .map_err(|e| e.to_string())?;
    let monitor = monitors
        .get(monitor_index)
        .ok_or("Monitor not found")?;

    let pos = monitor.position();
    let size = monitor.size();

    tauri::WebviewWindowBuilder::new(
        &app,
        "viewer",
        tauri::WebviewUrl::App("viewer.html".into()),
    )
    .title("Song Prompter - Viewer")
    .position(pos.x as f64, pos.y as f64)
    .inner_size(size.width as f64, size.height as f64)
    .fullscreen(true)
    .decorations(false)
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn auto_save(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let dir = get_save_dir(&app)?;
    let path = dir.join("last-project.json");
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn auto_load(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let dir = get_save_dir(&app)?;
    let path = dir.join("last-project.json");
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn save_project_dialog(data: String) -> Result<(), String> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json"])
        .set_file_name("song_prompter_project.json")
        .save_file()
        .ok_or_else(|| "Cancelled".to_string())?;
    fs::write(&path, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_project_dialog() -> Result<Option<String>, String> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json"])
        .pick_file();
    match path {
        Some(p) => {
            let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
            Ok(Some(content))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn import_txt_dialog() -> Result<Vec<TxtFile>, String> {
    let paths = rfd::FileDialog::new()
        .add_filter("Text", &["txt"])
        .pick_files();
    match paths {
        Some(files) => {
            let mut result = Vec::new();
            for p in files {
                let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
                let name = p
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                result.push(TxtFile { name, content });
            }
            Ok(result)
        }
        None => Ok(Vec::new()),
    }
}
```

- [ ] **Step 2: Write lib.rs**

Replace `src-tauri/src/lib.rs`:
```rust
mod commands;

use commands::*;
use tauri::Emitter;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_monitors,
            open_viewer_on_monitor,
            auto_save,
            auto_load,
            save_project_dialog,
            open_project_dialog,
            import_txt_dialog,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "viewer" {
                    let _ = window.app_handle().emit_to("main", "viewer-closed", ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Note: `emit_to` first argument is a window label string. If Tauri v2 requires `EventTarget`, use:
```rust
use tauri::EventTarget;
let _ = window.app_handle().emit_to(EventTarget::webview_window("main"), "viewer-closed", ());
```

- [ ] **Step 3: Verify main.rs**

`src-tauri/src/main.rs` should already contain (from `tauri init`):
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    song_prompter_lib::run();
}
```

If the crate name in `Cargo.toml` is `song-prompter`, the lib call is `song_prompter::run()`. Check `Cargo.toml` `[package] name` and adjust the import accordingly.

- [ ] **Step 4: Verify Rust compiles**

Run: `cd /Users/lunia/cld/prompt/src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: add Rust backend commands for file I/O, dialogs, monitors"
```

---

### Task 3: Frontend — styles.css

**Files:**
- Create: `src/styles.css`

- [ ] **Step 1: Extract CSS from original**

Open `/Users/lunia/Downloads/Промптер для текстов песен.html`.
Copy everything between `<style>` (line 6) and `</style>` (line 570) tags.
Save as `src/styles.css`.

The CSS is used unchanged — no modifications needed. It contains all styles for:
- Layout (sidebars, center area)
- Song list items (`.song-item`, `.active`, `.played`)
- Viewer mode (`.viewer-mode`, `.show-song-list`, `.is-fullscreen`)
- Two-window mode (`.two-window-mode`)
- Text alignment (`.align-left`)
- Viewer song list colors (`.pending` green, `.current` red, `.played` gray)
- Scrollbar styling
- Timeline markers and triggers
- Urgent messages
- Fullscreen hint animation

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: extract styles from original HTML"
```

---

### Task 4: Frontend — ltc-decoder.js

**Files:**
- Create: `src/ltc-decoder.js`

- [ ] **Step 1: Write ltc-decoder.js**

Create `src/ltc-decoder.js`. This is a direct extraction from the original (lines 782-946), unchanged:
```js
/**
 * Simple event emitter for the browser.
 */
class SimpleEventEmitter {
    constructor() {
        this._events = {};
    }
    on(event, listener) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(listener);
    }
    emit(event, ...args) {
        if (this._events[event]) {
            this._events[event].forEach((fn) => fn(...args));
        }
    }
}

/**
 * Frame encapsulates a single decoded LTC frame.
 */
class Frame {
    constructor(fps = 25) {
        this.fps = fps;
        this.frames = 0;
        this.seconds = 0;
        this.minutes = 0;
        this.hours = 0;
    }
    decode(bytes) {
        if (!bytes || bytes.length < 10) return;
        this.frames = (bytes[0] & 0x0f) + ((bytes[1] & 0x03) * 10);
        this.seconds = (bytes[2] & 0x0f) + ((bytes[3] & 0x07) * 10);
        this.minutes = (bytes[4] & 0x0f) + ((bytes[5] & 0x07) * 10);
        this.hours = (bytes[6] & 0x0f) + ((bytes[7] & 0x03) * 10);
    }
    toString() {
        const p = (n) => n.toString().padStart(2, '0');
        return `${p(this.hours)}:${p(this.minutes)}:${p(this.seconds)}:${p(this.frames)}`;
    }
}

/**
 * LTC audio decoder. Processes PCM float samples and emits 'frame' events
 * when a valid SMPTE timecode frame is detected.
 */
function Decoder(sampleRate) {
    SimpleEventEmitter.call(this);
    this.rate = sampleRate || 48000;
    this.framerate = 25;
    this.last_frame = null;
    this.state = {
        prev_sample: null,
        counter: 0,
        middle_transition: 0,
        bit_buffer: '',
    };

    this.decode = function (samples) {
        let bit_array = '';
        let prev_sample = this.state.prev_sample;
        let counter = this.state.counter;
        let middle_transition = this.state.middle_transition;
        if (prev_sample == null && samples.length > 0) {
            prev_sample = samples[0];
        }
        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            if (prev_sample > 0 && sample > 0) {
                counter++;
            } else if (prev_sample < 0 && sample < 0) {
                counter++;
            } else {
                const freq = this.rate / counter / 2;
                if (freq > 900 && freq <= 1560) {
                    bit_array += '0';
                } else if (freq > 1560 && freq < 3000) {
                    if (middle_transition) {
                        bit_array += '1';
                        middle_transition = 0;
                    } else {
                        middle_transition = 1;
                    }
                }
                counter = 0;
            }
            prev_sample = sample;
        }
        this.state.prev_sample = prev_sample;
        this.state.counter = counter;
        this.state.middle_transition = middle_transition;
        const bitrate = bit_array.length / (samples.length / this.rate);
        if (!isNaN(bitrate) && bitrate > 0) {
            this.framerate = Math.round(bitrate / 80);
        }
        this.state.bit_buffer = this.state.bit_buffer + bit_array;
        while (this.state.bit_buffer.length >= 80) {
            if (!this._parseBits()) {
                if (this.state.bit_buffer.length > 160) {
                    this.state.bit_buffer = this.state.bit_buffer.slice(160);
                }
                break;
            }
        }
    };

    this._parseBits = function () {
        const bit_string = this.state.bit_buffer;
        const sync_word_idx = bit_string.indexOf('111111111111');
        if (sync_word_idx < 0) return false;
        if (
            bit_string.substring(sync_word_idx - 2, sync_word_idx) === '00' &&
            bit_string.substring(sync_word_idx + 12, sync_word_idx + 14) === '01'
        ) {
            const bytes = [];
            for (let i = sync_word_idx - 66; i < sync_word_idx + 14; i += 8) {
                const bits = bit_string.substring(i, i + 8).split('').reverse().join('');
                const byte = parseInt(bits, 2);
                bytes.push(byte);
            }
            const frame = new Frame(this.framerate || 25);
            frame.decode(bytes);
            this.last_frame = frame;
            this.emit('frame', frame);
            this.state.bit_buffer = bit_string.slice(sync_word_idx + 14);
            return true;
        } else {
            return false;
        }
    };
}
Decoder.prototype = Object.create(SimpleEventEmitter.prototype);
Decoder.prototype.constructor = Decoder;
```

- [ ] **Step 2: Commit**

```bash
git add src/ltc-decoder.js
git commit -m "feat: extract LTC decoder module from original"
```

---

### Task 5: Frontend — i18n.js

**Files:**
- Create: `src/i18n.js`

- [ ] **Step 1: Write i18n.js**

Create `src/i18n.js` with translation dictionary and DOM update function. All translations extracted from the original `updateUITexts()` function (lines 1687-1852):

```js
const translations = {
    ru: {
        songs: 'Песни', addSong: 'Добавить песню',
        resetPlayed: 'Сбросить проигранные', resetPlayedTitle: 'Сбросить отметки проигранных песен',
        songPanel: 'Песня', songTitlePlaceholder: 'Название песни',
        deleteSong: 'Удалить песню',
        songDeleteNote: 'Удалить можно любую, кроме последней — она будет просто очищена.',
        displayPanel: 'Отображение',
        fontSize: 'Размер шрифта ', lineHeight: 'Межстрочный интервал ',
        textWidth: 'Ширина текста ',
        textWidthNote: 'Регулирует ширину области текста по центру экрана.',
        alignment: 'Выравнивание', alignCenter: 'По центру', alignLeft: 'По левому краю',
        scrollPanel: 'Прокрутка', bySpeed: 'По скорости', byDuration: 'По длительности',
        scrollSpeed: 'Скорость прокрутки ',
        scrollSpeedNote: 'Чем больше значение, тем быстрее движется текст.',
        songDuration: 'Длительность песни ',
        durationNoteHtml: 'Например: <b>3:45</b> или <b>225</b>.',
        start: 'Старт (Enter)', pauseResume: 'Пауза / Продолжить (Space)',
        stop: 'Стоп', toTop: 'В начало', secondScreen: 'Второй экран',
        fullscreenNoteHtml: 'Полноэкранный режим — клавиша <b>F</b> или <b>А</b> (русская раскладка).',
        titleLabel: 'Название:', lyricsPanel: 'Текст песни',
        lyricsPlaceholder: 'Введите текст песни здесь...',
        applyLyrics: 'Обновить текст', importTxt: 'Импорт TXT',
        lyricsNoteHtml: 'Русский текст поддерживается (UTF-8).<br>Для .doc/.docx лучше предварительно сохранить как .txt.',
        projectPanel: 'Проект', exportProject: 'Экспорт проекта', importProject: 'Импорт проекта',
        projectNote: 'Экспортирует все песни и настройки в один JSON-файл.',
        timecodePanel: 'Таймкод', audioInput: 'Аудио вход:',
        timelinePanel: 'Таймлайн', addStart: 'Добавить старт',
        addPause: 'Добавить паузу', addSpeed: 'Добавить скорость',
        triggersPanel: 'Привязка песен', addTrigger: 'Добавить привязку',
        secondScreenPanel: 'Второй экран', showSongList: 'Показать список песен',
        showSongListNote: 'На втором экране будет отображаться список песен слева от текста.',
        urgentMessagePanel: 'Экстренное сообщение',
        urgentPlaceholder: 'Введите срочное сообщение...',
        send: 'Отправить', hideMessage: 'Убрать сообщение',
        urgentNote: 'Сообщение появится на втором экране на 30 сек.',
        loveNote: 'С любовью из России',
        noDevices: 'Нет устройств', untitled: 'Без названия', songPrefix: 'Песня',
        markerStart: 'Старт', markerPause: 'Пауза', markerSpeed: 'Скорость',
        remove: 'Удалить', songListHeader: 'Список песен',
        fullscreenHint: 'Нажмите F для полноэкранного режима',
        chooseMonitor: 'Выберите монитор (введите номер):',
    },
    en: {
        songs: 'Songs', addSong: 'Add song',
        resetPlayed: 'Reset played', resetPlayedTitle: 'Reset played songs',
        songPanel: 'Song', songTitlePlaceholder: 'Song title',
        deleteSong: 'Delete song',
        songDeleteNote: 'You can delete any song except the last one — it will just be cleared.',
        displayPanel: 'Display',
        fontSize: 'Font size ', lineHeight: 'Line height ',
        textWidth: 'Text width ',
        textWidthNote: 'Adjusts the width of the text area in the center of the screen.',
        alignment: 'Alignment', alignCenter: 'Center', alignLeft: 'Left',
        scrollPanel: 'Scroll', bySpeed: 'By speed', byDuration: 'By duration',
        scrollSpeed: 'Scroll speed ',
        scrollSpeedNote: 'The larger the value, the faster the text moves.',
        songDuration: 'Song duration ',
        durationNoteHtml: 'For example: <b>3:45</b> or <b>225</b>.',
        start: 'Start (Enter)', pauseResume: 'Pause / Resume (Space)',
        stop: 'Stop', toTop: 'To top', secondScreen: 'Second screen',
        fullscreenNoteHtml: 'Fullscreen mode — key <b>F</b>.',
        titleLabel: 'Title:', lyricsPanel: 'Lyrics',
        lyricsPlaceholder: 'Enter lyrics here...',
        applyLyrics: 'Apply lyrics', importTxt: 'Import TXT',
        lyricsNoteHtml: 'Russian text is supported (UTF-8).<br>For .doc/.docx it is better to save as .txt first.',
        projectPanel: 'Project', exportProject: 'Export project', importProject: 'Import project',
        projectNote: 'Exports all songs and settings into a single JSON file.',
        timecodePanel: 'Timecode', audioInput: 'Audio input:',
        timelinePanel: 'Timeline', addStart: 'Add start',
        addPause: 'Add pause', addSpeed: 'Add speed change',
        triggersPanel: 'Song triggers', addTrigger: 'Add trigger',
        secondScreenPanel: 'Second screen', showSongList: 'Show song list',
        showSongListNote: 'The second screen will display the song list on the left side of the text.',
        urgentMessagePanel: 'Urgent message',
        urgentPlaceholder: 'Enter urgent message...',
        send: 'Send', hideMessage: 'Hide message',
        urgentNote: 'Message will appear on second screen for 30 sec.',
        loveNote: 'With Love From Russia',
        noDevices: 'No devices', untitled: 'Untitled', songPrefix: 'Song',
        markerStart: 'Start', markerPause: 'Pause', markerSpeed: 'Speed',
        remove: 'Remove', songListHeader: 'Song list',
        fullscreenHint: 'Press F for fullscreen mode',
        chooseMonitor: 'Choose monitor (enter number):',
    }
};

// Note: Keys ending in "Html" contain trusted hardcoded HTML (bold tags for
// UI hints like "<b>3:45</b>"). These are NOT user-supplied and are safe
// to assign via innerHTML. All other keys use textContent.

function updateUITexts(lang) {
    const t = translations[lang] || translations.ru;

    document.querySelector('#leftSidebar .sidebar-header span').textContent = t.songs;
    document.getElementById('addSongBtn').title = t.addSong;
    document.getElementById('resetPlayedBtn').textContent = t.resetPlayed;
    document.getElementById('resetPlayedBtn').title = t.resetPlayedTitle;

    document.getElementById('songPanelTitle').textContent = t.songPanel;
    document.getElementById('songTitleInput').placeholder = t.songTitlePlaceholder;
    document.getElementById('deleteSongBtn').textContent = t.deleteSong;
    document.getElementById('songDeleteNote').textContent = t.songDeleteNote;

    document.getElementById('displayPanelTitle').textContent = t.displayPanel;
    var fontLbl = document.getElementById('fontSizeRange').closest('label');
    if (fontLbl) fontLbl.childNodes[0].textContent = t.fontSize;
    var lhLbl = document.getElementById('lineHeightRange').closest('label');
    if (lhLbl) lhLbl.childNodes[0].textContent = t.lineHeight;
    var wLbl = document.getElementById('textWidthRange').closest('label');
    if (wLbl) wLbl.childNodes[0].textContent = t.textWidth;
    document.getElementById('textWidthNote').textContent = t.textWidthNote;

    var alignLbl = document.getElementById('textAlignLabel');
    if (alignLbl) alignLbl.textContent = t.alignment;
    var acOpt = document.getElementById('textAlignCenterOption');
    if (acOpt) acOpt.textContent = t.alignCenter;
    var alOpt = document.getElementById('textAlignLeftOption');
    if (alOpt) alOpt.textContent = t.alignLeft;

    document.getElementById('scrollPanelTitle').textContent = t.scrollPanel;
    document.getElementById('scrollSpeedModeLabel').textContent = t.bySpeed;
    document.getElementById('scrollDurationModeLabel').textContent = t.byDuration;
    var spLbl = document.getElementById('speedRange').closest('label');
    if (spLbl) spLbl.childNodes[0].textContent = t.scrollSpeed;
    document.getElementById('scrollSpeedNote').textContent = t.scrollSpeedNote;
    var durLbl = document.getElementById('durationInput').closest('label');
    if (durLbl) durLbl.childNodes[0].textContent = t.songDuration;
    // durationNoteHtml contains trusted hardcoded bold tags, not user input
    document.querySelector('#durationControls .small-note').innerHTML = t.durationNoteHtml;

    document.getElementById('startBtn').textContent = t.start;
    document.getElementById('pauseBtn').textContent = t.pauseResume;
    document.getElementById('stopBtn').textContent = t.stop;
    document.getElementById('topBtn').textContent = t.toTop;
    document.getElementById('secondScreenBtn').textContent = t.secondScreen;
    // fullscreenNoteHtml contains trusted hardcoded bold tags, not user input
    document.getElementById('fullscreenNote').innerHTML = t.fullscreenNoteHtml;

    var stLbl = document.getElementById('songTitleLabel');
    if (stLbl) stLbl.childNodes[0].textContent = t.titleLabel;

    document.getElementById('lyricsPanelTitle').textContent = t.lyricsPanel;
    document.getElementById('lyricsInput').placeholder = t.lyricsPlaceholder;
    document.getElementById('applyLyricsBtn').textContent = t.applyLyrics;
    document.getElementById('importTxtBtn').textContent = t.importTxt;
    // lyricsNoteHtml contains trusted hardcoded HTML, not user input
    document.getElementById('lyricsNote').innerHTML = t.lyricsNoteHtml;

    document.getElementById('projectPanelTitle').textContent = t.projectPanel;
    document.getElementById('exportProjectBtn').textContent = t.exportProject;
    document.getElementById('importProjectBtn').textContent = t.importProject;
    document.getElementById('projectNote').textContent = t.projectNote;

    document.getElementById('timecodePanelTitle').textContent = t.timecodePanel;
    document.getElementById('audioInputLabel').textContent = t.audioInput;

    document.getElementById('timelinePanelTitle').textContent = t.timelinePanel;
    document.getElementById('addStartMarkerBtn').textContent = t.addStart;
    document.getElementById('addPauseMarkerBtn').textContent = t.addPause;
    var asBtn = document.getElementById('addSpeedMarkerBtn');
    if (asBtn) asBtn.textContent = t.addSpeed;

    var trTitle = document.getElementById('triggersPanelTitle');
    if (trTitle) trTitle.textContent = t.triggersPanel;
    var atBtn = document.getElementById('addTriggerBtn');
    if (atBtn) atBtn.textContent = t.addTrigger;

    var ssTitle = document.getElementById('secondScreenPanelTitle');
    if (ssTitle) ssTitle.textContent = t.secondScreenPanel;
    var slLbl = document.getElementById('showSongListLabel');
    if (slLbl) slLbl.textContent = t.showSongList;
    var slNote = document.getElementById('showSongListNote');
    if (slNote) slNote.textContent = t.showSongListNote;

    var umTitle = document.getElementById('urgentMessagePanelTitle');
    if (umTitle) umTitle.textContent = t.urgentMessagePanel;
    var umInput = document.getElementById('urgentMessageInput');
    if (umInput) umInput.placeholder = t.urgentPlaceholder;
    var suBtn = document.getElementById('sendUrgentBtn');
    if (suBtn) suBtn.textContent = t.send;
    var huBtn = document.getElementById('hideUrgentBtn');
    if (huBtn) huBtn.textContent = t.hideMessage;
    var umNote = document.getElementById('urgentMessageNote');
    if (umNote) umNote.textContent = t.urgentNote;

    document.getElementById('loveNote').textContent = t.loveNote;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/i18n.js
git commit -m "feat: create i18n module with RU/EN translations"
```

---

### Task 6: Frontend — index.html (main window)

**Files:**
- Modify: `src/index.html` (replace placeholder)

- [ ] **Step 1: Write index.html**

Replace `src/index.html` with the main window markup. This is the original HTML body (lines 572-768) adapted:
- Removed `<a id="homeLink">` element
- Removed hidden `<input type="file">` elements (replaced by Tauri native dialogs)
- Added `<link>` to `styles.css`
- Added `<script>` tags for `ltc-decoder.js`, `i18n.js`, `app.js`
- Cleared inline style state (font-size, padding-bottom set by JS at runtime)
- Audio input `<select>` starts empty (populated by JS)

The `<head>` section:
```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Song Prompter</title>
    <link rel="stylesheet" href="styles.css">
</head>
```

The `<body>` content is the exact markup from the original file lines 572-768. Copy the entire `<div id="app">...</div>` structure. Then make these edits:

1. Remove the `<a id="homeLink" ...>` element (line 576)
2. Remove the two hidden file inputs at the bottom (lines 771-772: `<input type="file" id="txtFileInput" ...>` and `<input type="file" id="projectFileInput" ...>`)
3. Clear the `<select id="audioInputSelect">` — remove all `<option>` elements inside it (they get populated dynamically)
4. Remove inline `style="..."` from `#lyricsContainer` and `#lyricsText` (runtime state from saved page)
5. Add `<div class="song-item active"><div class="song-item-main"></div></div>` as empty initial state for `#songList` (or leave `#songList` empty — it's populated by JS)

End the body with scripts:
```html
    <script src="ltc-decoder.js"></script>
    <script src="i18n.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify HTML structure**

Run: `cd /Users/lunia/cld/prompt && npx tauri dev`
Expected: Window opens showing the three-panel layout. JS errors expected until app.js is written.

- [ ] **Step 3: Commit**

```bash
git add src/index.html
git commit -m "feat: create main window HTML markup"
```

---

### Task 7: Frontend — viewer.html

**Files:**
- Create: `src/viewer.html`

- [ ] **Step 1: Write viewer.html**

Create `src/viewer.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Song Prompter - Viewer</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body class="viewer-mode">
    <div id="app">
        <div id="viewerSongList">
            <div class="viewer-song-header">Список песен</div>
            <div id="viewerSongListItems"></div>
        </div>

        <div id="fullscreenHint">Нажмите F для полноэкранного режима</div>

        <div id="urgentMessageDisplay">
            <div id="urgentMessageText"></div>
        </div>

        <div id="center">
            <div id="lyricsContainer">
                <div id="lyricsText"></div>
            </div>
        </div>
    </div>

    <script src="viewer.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer.html
git commit -m "feat: create viewer window HTML"
```

---

### Task 8: Frontend — app.js (main window logic)

**Files:**
- Create: `src/app.js`

This is the largest file. It ports the entire main window logic from the original (lines 774-2521) with Tauri integration changes.

- [ ] **Step 1: Write app.js**

Create `src/app.js`. The file structure mirrors the original with these systematic replacements:

**A. Header — Tauri API access** (new):
```js
const { invoke } = window.__TAURI__.core;
const { emitTo, listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
```

**B. Global state** (original lines 948-971, add new vars):
Copy the original global variables block. Add:
```js
let viewerOpen = false;
let autoSaveTimeout = null;
```
Remove `let viewerWindow = null;` (replaced by `viewerOpen` flag).

**C. DOM element references** (original lines 973-999):
Copy as-is. Remove references to `txtFileInput` and `projectFileInput`.

**D. Helper functions** — copy unchanged from original:
- `defaultSong()` (lines 1026-1042)
- `createNewSong()` (lines 1044-1048)
- `parseDuration()` (lines 1226-1234)
- `formatDuration()` (lines 1236-1241)
- `pad()` (lines 1962-1964)
- `formatTimecode()` (lines 1966-1973)
- `parseTimecode()` (lines 1975-1989)

**E. Song list rendering** — copy from original with changes:
- `renderSongList()` (lines 1050-1094): unchanged
- `moveSong()` (lines 1096-1110): add `scheduleAutoSave()` at end
- `selectSong()` (lines 1112-1131): replace `syncToViewer()` call — same name, different implementation. Add `scheduleAutoSave()`
- `loadSongIntoUI()` (lines 1133-1185): unchanged (calls `syncToViewer()`)

**F. Display update functions** — copy unchanged from original:
- `updateFontSizeDisplay()` (lines 1188-1191)
- `updateLineHeightDisplay()` (lines 1193-1196)
- `updateTextWidthDisplay()` (lines 1198-1201)
- `updateScrollModeUI()` (lines 1203-1211)
- `updateSpeedLabel()` (lines 1213-1215)
- `updateTextAlign()` (lines 1217-1224)

**G. Scroll engine** — copy from original with viewer sync changes:
- `getEffectiveSpeed()` (lines 1244-1254): unchanged
- `startScroll()` (lines 1256-1274): add `scheduleAutoSave()` after marking played
- `scrollStep()` (lines 1276-1299): replace postMessage with:
  ```js
  if (viewerOpen) {
      emitTo('viewer', 'scroll', { scrollTop: lyricsContainer.scrollTop });
  }
  ```
- `pauseScroll()` (lines 1301-1304): unchanged
- `stopScroll()` (lines 1306-1313): replace postMessage with emitTo
- `applyExtraBottomPadding()` (lines 1320-1323): unchanged

**H. Event listeners** — copy from original with changes:
- All button/input handlers (lines 1326-1464): same logic
- Add `scheduleAutoSave()` call to each handler that changes state
- `secondScreenBtn` click (lines 1467-1479): replace with `openSecondScreen()` call
- `importTxtBtn` click: call `importTxtFiles()` instead of triggering hidden file input
- `exportProjectBtn` click: call `exportProject()`
- `importProjectBtn` click: call `importProject()`
- `lyricsContainer` scroll listener (lines 1459-1464): replace postMessage with emitTo
- `showSongListCheckbox` change (lines 1482-1487): add `scheduleAutoSave()` — wait, showSongListOnViewer is not persisted. Keep without autoSave.

**I. Second screen function** (replaces lines 1467-1479):
```js
async function openSecondScreen() {
    if (viewerOpen) return;
    try {
        const monitors = await invoke('list_monitors');
        let monitorIndex = 0;
        if (monitors.length === 2) {
            monitorIndex = 1;
        } else if (monitors.length > 2) {
            const t = translations[currentLang];
            const names = monitors.map((m, i) =>
                (i + 1) + ': ' + m.name + ' (' + m.width + 'x' + m.height + ')'
            ).join('\n');
            const choice = prompt(t.chooseMonitor + '\n' + names, '2');
            if (!choice) return;
            monitorIndex = parseInt(choice, 10) - 1;
            if (isNaN(monitorIndex) || monitorIndex < 0 || monitorIndex >= monitors.length) {
                monitorIndex = 1;
            }
        }
        await invoke('open_viewer_on_monitor', { monitorIndex: monitorIndex });
        viewerOpen = true;
        document.body.classList.add('two-window-mode');
    } catch (e) {
        console.error('Failed to open viewer:', e);
    }
}
```

**J. Viewer sync** (replaces lines 2263-2307):
```js
function syncToViewer() {
    if (!viewerOpen) return;
    var song = songs[selectedSongIndex];
    if (!song) return;
    var songListData = songs.map(function(s, idx) {
        return {
            title: s.title || translations[currentLang].untitled,
            played: s.played,
            isCurrent: idx === selectedSongIndex
        };
    });
    emitTo('viewer', 'update-song', {
        text: song.text || '',
        style: {
            fontSize: song.fontSize,
            lineHeight: song.lineHeight,
            widthPercent: song.textWidthPercent,
            textAlign: song.textAlign
        },
        scrollTop: lyricsContainer.scrollTop,
        showSongList: showSongListOnViewer,
        songList: songListData,
        lang: currentLang
    });
}
```

**K. File operations** (replaces lines 1562-1677):
```js
async function importTxtFiles() {
    var files = await invoke('import_txt_dialog');
    if (!files || files.length === 0) return;
    if (files.length === 1) {
        var song = songs[selectedSongIndex];
        if (!song) return;
        song.text = files[0].content;
        song.played = false;
        lyricsInput.value = song.text;
        lyricsText.textContent = song.text;
        lyricsContainer.scrollTop = 0;
        renderSongList();
        syncToViewer();
        scheduleAutoSave();
    } else {
        var firstNewIndex = null;
        files.forEach(function(file) {
            var newIndex = createNewSong();
            var s = songs[newIndex];
            s.text = file.content;
            s.title = file.name || s.title;
            s.played = false;
            if (firstNewIndex === null) firstNewIndex = newIndex;
        });
        renderSongList();
        if (firstNewIndex !== null) selectSong(firstNewIndex);
        scheduleAutoSave();
    }
}

function exportProjectData() {
    var plainTriggers = songTriggers.map(function(t) {
        return { time: t.time, songIndex: t.songIndex };
    });
    return { version: 3, selectedSongIndex: selectedSongIndex, songs: songs, songTriggers: plainTriggers };
}

async function exportProject() {
    var data = exportProjectData();
    try {
        await invoke('save_project_dialog', { data: JSON.stringify(data, null, 2) });
    } catch (e) {
        if (e !== 'Cancelled') console.error(e);
    }
}

async function importProject() {
    var content;
    try { content = await invoke('open_project_dialog'); }
    catch (e) { console.error(e); return; }
    if (!content) return;
    try {
        var json = JSON.parse(content);
        if (!Array.isArray(json.songs)) { alert('Invalid project file.'); return; }
        songs = json.songs.map(function(s) { return Object.assign({}, defaultSong(), s); });
        if (!songs.length) songs.push(defaultSong());
        selectedSongIndex = Math.min(json.selectedSongIndex || 0, songs.length - 1);
        songCounter = songs.length + 1;
        songTriggers = Array.isArray(json.songTriggers)
            ? json.songTriggers.map(function(t) { return { time: t.time || 0, songIndex: t.songIndex || 0, _triggered: false }; })
            : [];
        renderSongList();
        renderTriggers();
        resetTriggerStates();
        loadSongIntoUI();
        startTimecode();
        scheduleAutoSave();
    } catch (err) {
        console.error(err);
        alert('Error reading project.');
    }
}
```

**L. Auto-save/load** (new):
```js
function scheduleAutoSave() {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async function() {
        var data = exportProjectData();
        try { await invoke('auto_save', { data: JSON.stringify(data) }); }
        catch (e) { console.error('Auto-save failed:', e); }
    }, 500);
}

async function autoLoad() {
    try {
        var content = await invoke('auto_load');
        if (!content) return false;
        var json = JSON.parse(content);
        if (!Array.isArray(json.songs) || !json.songs.length) return false;
        songs = json.songs.map(function(s) { return Object.assign({}, defaultSong(), s); });
        selectedSongIndex = Math.min(json.selectedSongIndex || 0, songs.length - 1);
        songCounter = songs.length + 1;
        songTriggers = Array.isArray(json.songTriggers)
            ? json.songTriggers.map(function(t) { return { time: t.time || 0, songIndex: t.songIndex || 0, _triggered: false }; })
            : [];
        return true;
    } catch (e) {
        console.error('Auto-load failed:', e);
        return false;
    }
}
```

**M. Urgent messages** (original lines 1489-1548):
Copy from original. Replace `viewerWindow.postMessage(...)` with:
```js
emitTo('viewer', 'urgent-message', { text: message, duration: 30000 });
```
and:
```js
emitTo('viewer', 'hide-urgent', {});
```

**N. Localization handler** (original lines 1679-1686):
```js
var languageSelect = document.getElementById('languageSelect');
languageSelect.addEventListener('change', function() {
    currentLang = languageSelect.value;
    updateUITexts(currentLang);
    renderTriggers();
    renderSongList();
    syncToViewer();
});
```

**O. LTC/timecode, markers, triggers** (original lines 1854-2260):
Copy unchanged from original. These sections use `navigator.mediaDevices` (works in Tauri WebView) and internal state only. Use `translations[currentLang]` for marker/trigger labels in `renderMarkers()` and `renderTriggers()`.

**P. Keyboard shortcuts** (original lines 2309-2363):
Replace `toggleFullScreen()`:
```js
async function toggleFullScreen() {
    var appWindow = getCurrentWindow();
    var isFs = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFs);
    if (viewerOpen) {
        emitTo('viewer', isFs ? 'exit-fullscreen' : 'enter-fullscreen', {});
    }
}
```
`isEditingElement()` and keydown handler — unchanged from original.

**Q. Initialization** (replaces lines 2367-2521):
```js
(async function init() {
    var loaded = await autoLoad();
    if (!loaded) {
        var firstIndex = createNewSong();
        selectedSongIndex = firstIndex;
    }
    renderSongList();
    loadSongIntoUI();
    applyExtraBottomPadding();
    populateAudioInputs();
    startTimecode();
    updateUITexts(currentLang);
    renderTriggers();

    listen('viewer-ready', function() {
        viewerOpen = true;
        document.body.classList.add('two-window-mode');
        syncToViewer();
    });

    listen('viewer-closed', function() {
        viewerOpen = false;
        document.body.classList.remove('two-window-mode');
    });
})();
```

**Assembly note:** Combine all sections A through Q into a single `src/app.js` file. The sections must appear in the order listed. Where a section says "copy from original," copy the exact code from the referenced line numbers in `/Users/lunia/Downloads/Промптер для текстов песен.html` and apply only the noted modifications.

- [ ] **Step 2: Commit**

```bash
git add src/app.js
git commit -m "feat: create main window app logic with Tauri integration"
```

---

### Task 9: Frontend — viewer.js

**Files:**
- Create: `src/viewer.js`

- [ ] **Step 1: Write viewer.js**

Create `src/viewer.js`:
```js
var tauriEvent = window.__TAURI__.event;
var emitTo = tauriEvent.emitTo;
var listen = tauriEvent.listen;
var getCurrentWindow = window.__TAURI__.window.getCurrentWindow;

var lyricsContainer = document.getElementById('lyricsContainer');
var lyricsText = document.getElementById('lyricsText');
var fullscreenHint = document.getElementById('fullscreenHint');
var urgentMessageDisplay = document.getElementById('urgentMessageDisplay');
var urgentMessageText = document.getElementById('urgentMessageText');
var viewerSongListItemsEl = document.getElementById('viewerSongListItems');

var urgentMessageTimeout = null;

// --- Fullscreen management ---

async function updateFullscreenState() {
    var appWindow = getCurrentWindow();
    var isFs = await appWindow.isFullscreen();
    document.body.classList.toggle('is-fullscreen', isFs);
}

async function toggleFullscreen() {
    var appWindow = getCurrentWindow();
    var isFs = await appWindow.isFullscreen();
    await appWindow.setFullscreen(!isFs);
    document.body.classList.toggle('is-fullscreen', !isFs);
}

if (fullscreenHint) {
    fullscreenHint.addEventListener('click', async function() {
        var appWindow = getCurrentWindow();
        await appWindow.setFullscreen(true);
        document.body.classList.add('is-fullscreen');
    });
}

document.addEventListener('keydown', function(e) {
    var key = e.key;
    if (key === 'f' || key === 'F' || key === '\u0430' || key === '\u0410') {
        e.preventDefault();
        toggleFullscreen();
    }
});

// --- Urgent messages ---

function showUrgentMessage(text, duration) {
    if (!urgentMessageDisplay || !urgentMessageText) return;
    urgentMessageText.textContent = text;
    urgentMessageDisplay.classList.add('visible');
    if (urgentMessageTimeout) clearTimeout(urgentMessageTimeout);
    urgentMessageTimeout = setTimeout(function() {
        hideUrgentMessage();
    }, duration || 30000);
}

function hideUrgentMessage() {
    if (!urgentMessageDisplay) return;
    urgentMessageDisplay.classList.remove('visible');
    if (urgentMessageTimeout) {
        clearTimeout(urgentMessageTimeout);
        urgentMessageTimeout = null;
    }
}

// --- Viewer song list ---

function renderViewerSongList(songList, lang) {
    if (!viewerSongListItemsEl || !Array.isArray(songList)) return;
    viewerSongListItemsEl.textContent = '';

    var header = document.querySelector('#viewerSongList .viewer-song-header');
    if (header) {
        header.textContent = lang === 'ru' ? 'Список песен' : 'Song list';
    }

    songList.forEach(function(song, index) {
        var item = document.createElement('div');
        item.className = 'viewer-song-item';
        if (song.isCurrent) {
            item.classList.add('current');
        } else if (song.played) {
            item.classList.add('played');
        } else {
            item.classList.add('pending');
        }
        item.textContent = (index + 1) + '. ' + song.title;
        viewerSongListItemsEl.appendChild(item);
    });
}

// --- Tauri event listeners ---

listen('update-song', function(event) {
    var msg = event.payload;
    lyricsText.textContent = msg.text || '';
    if (msg.style) {
        lyricsText.style.fontSize = (msg.style.fontSize || 32) + 'px';
        lyricsText.style.lineHeight = msg.style.lineHeight || 0.8;
        lyricsContainer.style.maxWidth = (msg.style.widthPercent || 100) + '%';
        if (msg.style.textAlign) {
            lyricsText.style.textAlign = msg.style.textAlign;
            if (msg.style.textAlign === 'left') {
                lyricsText.classList.add('align-left');
            } else {
                lyricsText.classList.remove('align-left');
            }
        }
    }
    if (typeof msg.scrollTop === 'number') {
        lyricsContainer.scrollTop = msg.scrollTop;
    }
    if (msg.showSongList) {
        document.body.classList.add('show-song-list');
        renderViewerSongList(msg.songList, msg.lang);
    } else {
        document.body.classList.remove('show-song-list');
    }
    if (fullscreenHint && msg.lang) {
        fullscreenHint.textContent = msg.lang === 'ru'
            ? 'Нажмите F для полноэкранного режима'
            : 'Press F for fullscreen mode';
    }
});

listen('scroll', function(event) {
    var msg = event.payload;
    if (typeof msg.scrollTop === 'number') {
        lyricsContainer.scrollTop = msg.scrollTop;
    }
});

listen('enter-fullscreen', async function() {
    var appWindow = getCurrentWindow();
    await appWindow.setFullscreen(true);
    document.body.classList.add('is-fullscreen');
});

listen('exit-fullscreen', async function() {
    var appWindow = getCurrentWindow();
    await appWindow.setFullscreen(false);
    document.body.classList.remove('is-fullscreen');
});

listen('urgent-message', function(event) {
    var msg = event.payload;
    showUrgentMessage(msg.text, msg.duration);
});

listen('hide-urgent', function() {
    hideUrgentMessage();
});

// --- Init ---

(async function init() {
    await updateFullscreenState();
    emitTo('main', 'viewer-ready', {});
})();
```

- [ ] **Step 2: Commit**

```bash
git add src/viewer.js
git commit -m "feat: create viewer window logic with Tauri event listeners"
```

---

### Task 10: Integration — first run and verification

**Files:**
- Possibly modify any file to fix issues found during testing

- [ ] **Step 1: Run the app**

Run: `cd /Users/lunia/cld/prompt && npx tauri dev`
Expected: Main window opens with three-panel layout. Console may show warnings but no blocking errors.

- [ ] **Step 2: Verify basic functionality**

Test each area (fix issues as found):
1. **Song management:** Add song, rename, delete, reorder with arrows. Delete last song (should clear, not remove). Reset played.
2. **Lyrics:** Type text in textarea, click "Apply lyrics." Text appears in center panel.
3. **Display settings:** Adjust font size (16-72), line height (0.1-2.5), text width (40-100%), alignment (center/left). All should update live.
4. **Scroll:** Start (Enter), Pause/Resume (Space), Stop, To Top. Speed slider (1-400). Duration mode.
5. **Second screen:** Click "Second screen." Should prompt for monitor if >2. Viewer opens fullscreen. Text syncs. Scroll syncs. F key toggles fullscreen. Urgent message appears/hides.
6. **LTC:** Audio input dropdown populated. Timecode clock shows dash. (Full LTC testing requires a timecode source.)
7. **Localization:** Switch to English, all labels update. Switch back to Russian.
8. **Persistence:** Close app, reopen — last state should be restored. Export project to JSON. Import it back.
9. **TXT import:** Click "Import TXT," select .txt file — loads into current song. Select multiple — creates new songs.

- [ ] **Step 3: Fix any Tauri API issues**

Common issues to watch for:
- `window.__TAURI__` path might differ — check browser console for the actual structure
- `emitTo` signature might need `EventTarget` object instead of string label
- `getCurrentWindow` might be at `window.__TAURI__.webviewWindow.getCurrentWebviewWindow` instead
- Capabilities might need additional permissions — check error messages
- `rfd::FileDialog` might need async wrapping if blocking causes issues on macOS
- `m.name()` in Rust might return `Option<&String>` or `Option<String>` — adjust `.cloned()` or remove as needed

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve integration issues from first run"
```

- [ ] **Step 5: Final verification**

Run the full manual testing checklist from the spec:
- Songs, scroll, display, second screen, LTC, persistence, localization, keyboard shortcuts, played status, edge cases

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "feat: Song Prompter Tauri app — initial working version"
```
