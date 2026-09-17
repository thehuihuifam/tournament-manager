import { ProjectorTheme } from './types';

/**
 * 프로젝터 발표 모드 테마.
 * - 기본값은 라이트(밝은 배경 + 진한 글자) — 체육관 조명 환경에서 대비가 좋다.
 * - 값은 AppState.projectorTheme 로 저장되며(localStorage), 없거나 손상된 값이면 라이트로 복구한다.
 */
export const DEFAULT_PROJECTOR_THEME: ProjectorTheme = 'light';

/** 저장값(문자열/undefined/손상) → 유효한 테마. 알 수 없는 값은 라이트로 마이그레이션. */
export function normalizeProjectorTheme(value: unknown): ProjectorTheme {
  return value === 'dark' || value === 'light' ? value : DEFAULT_PROJECTOR_THEME;
}

/** ☀️ ↔ 🌙 전환 */
export function toggleProjectorTheme(theme: ProjectorTheme): ProjectorTheme {
  return normalizeProjectorTheme(theme) === 'dark' ? 'light' : 'dark';
}

/** 프로젝터 루트에 붙는 테마 클래스 (`projector pj-light` / `projector pj-dark`) */
export function projectorThemeClass(theme: ProjectorTheme): string {
  return `pj-${normalizeProjectorTheme(theme)}`;
}

/** 토글 버튼 라벨/아이콘 — 현재 테마에서 "전환하면 될 모습"을 보여준다. */
export function projectorThemeToggleLabel(theme: ProjectorTheme): string {
  return normalizeProjectorTheme(theme) === 'dark' ? '☀️ 라이트' : '🌙 다크';
}
