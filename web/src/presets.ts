import { Athlete, EventKind, EventPreset, Match, Team, TEvent } from './types';

/** 스포츠스태킹 6개 종목 프리셋 (개인 3종 + 더블 3종) */
export const PRESETS: EventPreset[] = [
  { id: 'ind-333', name: '3-3-3 (개인)', short: '3-3-3', kind: 'individual', desc: '개인 · 3-3-3 시퀀스' },
  { id: 'ind-363', name: '3-6-3 (개인)', short: '3-6-3', kind: 'individual', desc: '개인 · 3-6-3 시퀀스' },
  { id: 'ind-cycle', name: '사이클 (개인)', short: '사이클', kind: 'individual', desc: '개인 · 사이클' },
  { id: 'dbl-333', name: '더블 3-3-3', short: '더블 3-3-3', kind: 'double', desc: '더블 · 2~3인 1팀' },
  { id: 'dbl-363', name: '더블 3-6-3', short: '더블 3-6-3', kind: 'double', desc: '더블 · 2~3인 1팀' },
  { id: 'dbl-cycle', name: '더블 사이클', short: '더블 사이클', kind: 'double', desc: '더블 · 2~3인 1팀' },
];

export function presetOf(id: string): EventPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function initialEvents(): TEvent[] {
  return PRESETS.map((p) => ({
    id: p.id,
    teams: [],
    excludedIds: [],
    matches: null,
    scoreMode: 'time',
    seedMode: 'order',
    currentMatchId: null,
  }));
}

/** 개인전: 로스터(참가번호 순)에서 제외자를 뺀 팀 목록 */
export function individualTeams(athletes: Athlete[], ev: TEvent): Team[] {
  return athletes
    .filter((a) => !ev.excludedIds.includes(a.id))
    .sort((x, y) => x.no - y.no)
    .map((a) => ({ id: `ind-${a.id}`, name: a.name, members: [a.id] }));
}

/** 종목의 유효 팀 목록 (더블은 구성원이 2명 또는 3명인 완성 팀) */
export function getTeams(athletes: Athlete[], ev: TEvent, kind: EventKind): Team[] {
  return kind === 'individual'
    ? individualTeams(athletes, ev)
    : ev.teams.filter((t) => t.members.length === 2 || t.members.length === 3);
}

/** 팀 카드에 표시할 슬롯 수 — 3인 팀이면 0·1·2번 세 슬롯, 그 외 0·1번 두 슬롯 */
export function teamSlotCount(t: Team): 2 | 3 {
  return t.size === 3 || t.members.length >= 3 ? 3 : 2;
}

export function roundCount(matches: Match[]): number {
  return matches.reduce((mx, m) => Math.max(mx, m.round + 1), 0);
}

export function roundName(matches: Match[], round: number): string {
  const total = roundCount(matches);
  const competing = Math.pow(2, total - round);
  if (competing === 2) return '결승';
  if (competing === 4) return '준결승 (4강)';
  return `${competing}강`;
}

export function eventStatus(ev: TEvent): 'none' | 'running' | 'done' {
  if (!ev.matches) return 'none';
  const last = roundCount(ev.matches) - 1;
  return ev.matches.every((m) => m.round !== last || m.decided) ? 'done' : 'running';
}

export function teamMap(teams: Team[]): Map<string, Team> {
  return new Map(teams.map((t) => [t.id, t]));
}
