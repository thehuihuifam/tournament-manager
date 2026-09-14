import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 주의: Vite 루트는 src/ 이다. 저장소 루트의 index.html은 배포용 단일 파일
// 산출물이므로 개발 진입점(src/index.html)과 충돌하지 않도록 분리한다.
// 빌드 결과는 dist/index.html 로 생성된다.
export default defineConfig({
  root: 'src',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
