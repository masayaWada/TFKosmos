// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

struct BackendProcess {
    process: Option<Child>,
}

impl BackendProcess {
    fn new() -> Self {
        Self { process: None }
    }

    fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // プロジェクトルートのパスを取得
        let current_dir = std::env::current_dir()?;
        // deployment/src-tauriから実行される場合、2階層上がる
        let project_root = if current_dir.ends_with("src-tauri") {
            current_dir.parent().and_then(|p| p.parent())
        } else {
            Some(current_dir.as_path())
        }
        .ok_or("Failed to determine project root")?;
        
        let backend_dir = project_root.join("backend");
        
        if !backend_dir.exists() {
            return Err("Backend directory not found".into());
        }
        
        // 開発モードかどうかを確認
        let is_debug = cfg!(debug_assertions);
        
        // バックエンドサーバーを起動
        let mut cmd = Command::new("cargo");
        if is_debug {
            cmd.arg("run");
        } else {
            cmd.args(&["run", "--release"]);
        }
        
        // 標準出力と標準エラー出力を継承して、ログを確認できるようにする
        println!("Starting backend server in: {:?}", backend_dir);
        let child = cmd
            .current_dir(&backend_dir)
            .stdout(Stdio::inherit())  // 標準出力を継承（ログを表示）
            .stderr(Stdio::inherit())  // 標準エラー出力を継承（エラーを表示）
            .spawn()?;
        
        self.process = Some(child);
        println!("Backend server process spawned, waiting for server to be ready...");
        
        // バックエンドサーバーの起動を待つ（最大30秒、初回ビルドに時間がかかる場合がある）
        let max_wait = 30;
        let mut waited = 0;
        let mut server_ready = false;
        
        while waited < max_wait && !server_ready {
            std::thread::sleep(std::time::Duration::from_secs(1));
            waited += 1;
            
            // HTTPリクエストでサーバーが応答するか確認
            match reqwest::blocking::Client::new()
                .get("http://localhost:8000/health")
                .timeout(std::time::Duration::from_secs(1))
                .send()
            {
                Ok(response) if response.status().is_success() => {
                    server_ready = true;
                    println!("✓ Backend server is ready on http://localhost:8000");
                    break;
                }
                Ok(_) => {
                    // サーバーは応答しているが、期待したステータスコードではない
                    server_ready = true;
                    println!("✓ Backend server responded on http://localhost:8000");
                    break;
                }
                Err(_) => {
                    // サーバーがまだ起動していない
                    if waited % 5 == 0 {
                        println!("Waiting for backend server to start... ({}s / {}s)", waited, max_wait);
                    }
                }
            }
        }
        
        if !server_ready {
            eprintln!("⚠ Warning: Backend server may not be ready yet after {} seconds.", max_wait);
            eprintln!("  The server might still be compiling. Please check the logs above.");
        }
        
        Ok(())
    }

    fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            #[cfg(unix)]
            {
                let _ = process.kill();
            }
            #[cfg(windows)]
            {
                let _ = process.kill();
            }
            let _ = process.wait();
            println!("Backend server stopped");
        }
    }
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

fn main() {
    let backend_process = Arc::new(Mutex::new(BackendProcess::new()));
    let backend_process_clone = backend_process.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |_app| {
            // バックエンドサーバーを起動
            let mut bp = backend_process_clone.lock().unwrap();
            if let Err(e) = bp.start() {
                eprintln!("Failed to start backend server: {}", e);
                // エラーが発生してもアプリは続行（ユーザーが手動で起動できる）
            }
            drop(bp);
            
            // アプリ終了時にバックエンドプロセスを終了
            // Dropトレイトで自動的にクリーンアップされる
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    // アプリ終了時にクリーンアップ
    let mut bp = backend_process.lock().unwrap();
    bp.stop();
}
