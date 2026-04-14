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
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
pub fn list_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let main_window = app.get_webview_window("main").ok_or("Main window not found")?;
    let monitors = main_window.available_monitors().map_err(|e| e.to_string())?;
    Ok(monitors.iter().map(|m| {
        let size = m.size();
        let pos = m.position();
        MonitorInfo {
            name: m.name().cloned().unwrap_or_default(),
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
        }
    }).collect())
}

#[tauri::command]
pub fn open_viewer_on_monitor(app: tauri::AppHandle, monitor_index: usize) -> Result<(), String> {
    if app.get_webview_window("viewer").is_some() {
        let viewer = app.get_webview_window("viewer").unwrap();
        viewer.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let main_window = app.get_webview_window("main").ok_or("Main window not found")?;
    let monitors: Vec<_> = main_window.available_monitors().map_err(|e| e.to_string())?;
    let monitor = monitors.get(monitor_index).ok_or("Monitor not found")?;
    let pos = monitor.position();
    let size = monitor.size();
    tauri::WebviewWindowBuilder::new(&app, "viewer", tauri::WebviewUrl::App("viewer.html".into()))
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
    let path = rfd::FileDialog::new().add_filter("JSON", &["json"]).pick_file();
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
    let paths = rfd::FileDialog::new().add_filter("Text", &["txt"]).pick_files();
    match paths {
        Some(files) => {
            let mut result = Vec::new();
            for p in files {
                let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
                let name = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
                result.push(TxtFile { name, content });
            }
            Ok(result)
        }
        None => Ok(Vec::new()),
    }
}
