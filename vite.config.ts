import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 소스 루트는 web/ 폴더. 빌드 출력은 저장소 루트의 dist/ 폴더.
// GitHub Pages(legacy: main 브랜치 루트)와 CI(gh-pages 브랜치) 모두 사용 가능하도록
// base를 상대경로('./')로 설정해 서브패스(thehuihuifam.github.io/tournament-manager/)에서 동작.
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    host: '0.0.0.0',
    // 개발 서버 전용 — LAN 데모·샌드박스 프록시 미리보기 호스트에서도 접속할 수 있도록 허용
    allowedHosts: true,
  },
});
