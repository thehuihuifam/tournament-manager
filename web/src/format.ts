/** 밀리초 -> "M:SS.mmm" */
export function formatTime(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = Math.round(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

/**
 * 시간 입력 파싱. 허용: "23.456" / "23" / "0:23.456" / "1:02.5" (초.밀리초 또는 분:초.밀리초)
 */
export function parseTime(raw: string): number | null {
  const cleaned = raw.trim().replace(/[\s,·]/g, '');
  if (!cleaned) return null;
  if (/^\d{1,3}$/.test(cleaned)) return parseInt(cleaned, 10) * 1000;
  const parts = cleaned.split(':');
  if (parts.length === 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}(\.\d{1,3})?$/.test(parts[1])) {
    return Math.round((parseInt(parts[0], 10) * 60 + parseFloat(parts[1])) * 1000);
  }
  if (/^\d{1,3}(\.\d{1,3})?$/.test(cleaned)) return Math.round(parseFloat(cleaned) * 1000);
  return null;
}

export function parseGenderToken(s: string): 'M' | 'F' | null {
  const t = s.trim();
  if (['남', '남자', '남성', 'M', 'm', 'male', 'MALE'].includes(t)) return 'M';
  if (['여', '여자', '여성', 'F', 'f', 'female', 'FEMALE'].includes(t)) return 'F';
  return null;
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const TEAM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export function teamAutoName(i: number): string {
  return `${TEAM_LETTERS[i % 26]}팀`;
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
