import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // ソースマップを本番環境では無効化（バンドルサイズ削減）
    sourcemap: false,
    // ターゲットブラウザを指定（モダンブラウザのみ）
    target: 'es2020',
    // チャンク分割の最適化
    rollupOptions: {
      output: {
        // ベンダーライブラリを分割
        manualChunks: {
          // Reactコア
          'react-vendor': ['react', 'react-dom'],
          // ルーティング
          'router': ['react-router-dom'],
          // HTTPクライアント
          'http-client': ['axios'],
          // Monaco Editor（大きいため別チャンク）
          'monaco': ['@monaco-editor/react'],
        },
      },
    },
    // チャンクサイズ警告の閾値（KB）
    chunkSizeWarningLimit: 500,
  },
})

