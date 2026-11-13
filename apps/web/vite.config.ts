import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // GitHub Pages는 https://<사용자>.github.io/memory-poker/ 아래에서 서비스되므로 빌드(와 빌드 결과를 띄우는 preview)에는
  // 경로 접두사를 붙인다. 개발 서버(pnpm dev)는 그대로 http://localhost:5173/
  base: command === 'build' || isPreview === true ? '/memory-poker/' : '/',
}));
