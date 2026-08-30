import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发环境将 /api 代理到后端 Java Spring Boot 服务（端口与 application.yml 的 PORT 默认 3100 一致）
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3100',
    },
  },
});
