mod commands;

use commands::*;
use tauri::Emitter;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
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
