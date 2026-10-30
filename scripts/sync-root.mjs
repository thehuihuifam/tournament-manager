#!/usr/bin/env node
/**
 * GitHub Pages 폴백 동기화.
 *
 * README의 배포 방식은 두 가지를 동시에 지원한다.
 *  1) gh-pages 브랜치 (deploy.yml이 dist/를 배포)
 *  2) 저장소 루트(main)에 커밋된 빌드 산출물 (Pages 설정이 legacy로 되돌아간 경우)
 *
 * 2번 폴백이 오래된 코드를 서빙하지 않도록, 방금 만든 dist/ 를 루트로 복사한다.
 * 사용법: npm run sync:root  (내부에서 빌드까지 수행)
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html 이 없습니다. 먼저 `npm run build`를 실행하세요.');
  process.exit(1);
}

// 1) 루트 assets/ 를 새 빌드 산출물로 교체 (해시가 바뀐 이전 파일은 제거)
rmSync(join(root, 'assets'), { recursive: true, force: true });
cpSync(join(dist, 'assets'), join(root, 'assets'), { recursive: true });

// 2) 루트 index.html 갱신
const html = readFileSync(join(dist, 'index.html'), 'utf8');
writeFileSync(join(root, 'index.html'), html);

const files = readdirSync(join(root, 'assets')).sort();
console.log(`✅ 루트 폴백 갱신 완료: index.html + assets/[${files.join(', ')}]`);
