use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize)]
pub struct MonitorInfo {
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_main: bool,
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

    // Detect which monitor the main window is on
    let main_pos = main_window.outer_position().unwrap_or(tauri::PhysicalPosition { x: 0, y: 0 });

    Ok(monitors
        .iter()
        .map(|m| {
            let size = m.size();
            let pos = m.position();
            let contains_main = main_pos.x >= pos.x
                && main_pos.x < pos.x + size.width as i32
                && main_pos.y >= pos.y
                && main_pos.y < pos.y + size.height as i32;
            MonitorInfo {
                name: m.name().cloned().unwrap_or_default(),
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
                is_main: contains_main,
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
    let monitor = monitors.get(monitor_index).ok_or("Monitor not found")?;
    let pos = monitor.position();
    let size = monitor.size();

    // Use borderless window covering the entire monitor instead of native fullscreen.
    // Native fullscreen on macOS creates a Space which hides the main window behind
    // a black overlay — this avoids that issue entirely.
    tauri::WebviewWindowBuilder::new(
        &app,
        "viewer",
        tauri::WebviewUrl::App("viewer.html".into()),
    )
    .title("Mini Prompter Lunia - Viewer")
    .position(pos.x as f64, pos.y as f64)
    .inner_size(size.width as f64, size.height as f64)
    .decorations(false)
    .always_on_top(true)
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

/// Extract plain text from a .docx file (ZIP archive with word/document.xml).
fn extract_text_from_docx(path: &std::path::Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .map_err(|e| e.to_string())?
        .read_to_string(&mut xml)
        .map_err(|e| e.to_string())?;

    // Extract text from <w:t>...</w:t> tags, newline at each </w:p>
    let mut result = String::new();
    let mut pos = 0;

    while pos < xml.len() {
        if let Some(p_end) = xml[pos..].find("</w:p>") {
            let section = &xml[pos..pos + p_end];
            let mut para = String::new();
            let mut t_pos = 0;
            while t_pos < section.len() {
                if let Some(t_start) = section[t_pos..].find("<w:t") {
                    let abs = t_pos + t_start;
                    if let Some(gt) = section[abs..].find('>') {
                        let text_start = abs + gt + 1;
                        if let Some(t_end) = section[text_start..].find("</w:t>") {
                            para.push_str(&section[text_start..text_start + t_end]);
                            t_pos = text_start + t_end + 6;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
            if !para.is_empty() || !result.is_empty() {
                result.push_str(&para);
                result.push('\n');
            }
            pos += p_end + 6;
        } else {
            break;
        }
    }
    Ok(result.trim_end().to_string())
}

#[tauri::command]
pub fn import_txt_dialog() -> Result<Vec<TxtFile>, String> {
    let paths = rfd::FileDialog::new()
        .add_filter("Text & Word", &["txt", "docx", "doc"])
        .add_filter("Text files", &["txt"])
        .add_filter("Word documents", &["docx"])
        .pick_files();
    match paths {
        Some(files) => {
            let mut result = Vec::new();
            for p in files {
                let ext = p
                    .extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let content = if ext == "docx" {
                    extract_text_from_docx(&p)?
                } else {
                    fs::read_to_string(&p).map_err(|e| e.to_string())?
                };
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
