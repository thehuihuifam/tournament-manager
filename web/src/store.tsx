import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import {
  AppState,
  Athlete,
  Gender,
  Match,
  ProjectorTheme,
  ScoreMode,
  SeedMode,
  Step,
  Team,
  TEvent,
} from './types';
import { PRESETS, getTeams, initialEvents, presetOf, teamMap } from './presets';
import {
  autoCurrentId,
  buildMatches,
  decideFromScores,
  propagate,
  shufflePairings,
  withValidPairings,
} from './bracket';
import {
  DEFAULT_PROJECTOR_THEME,
  normalizeProjectorTheme,
  toggleProjectorTheme,
} from './theme';
import { uid } from './format';

const LS_KEY = 'stacking-tournament-v2';
const LS_KEY_V1 = 'stacking-tournament-v1';

export function defaultState(): AppState {
  return {
    athletes: [],
    events: initialEvents(),
    activeEventId: PRESETS[0].id,
    step: 'participants',
    projector: false,
    projectorTheme: DEFAULT_PROJECTOR_THEME,
  };
}

/**
 * 저장값/백업 파일의 참가자 배열을 안전하게 복구한다.
 * - 이름이 없는 항목은 버리고, id 중복은 새 id로 바꾼다.
 * - 참가번호는 배열 순서대로 1..n 으로 다시 매긴다 (번호 = 시드 순서).
 */
export function sanitizeAthletes(raw: unknown): Athlete[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const items: { athlete: Athlete; savedNo: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const src = item as Partial<Athlete>;
    const name = typeof src.name === 'string' ? src.name.trim() : '';
    if (!name) continue;
    let id = typeof src.id === 'string' && src.id ? src.id : uid('a');
    if (seen.has(id)) id = uid('a');
    seen.add(id);
    items.push({
      athlete: { id, no: 0, name, gender: src.gender === 'F' ? 'F' : 'M' },
      // 저장된 참가번호(=시드 순서)를 존중한다. 번호가 없으면 배열 순서를 따른다.
      savedNo: typeof src.no === 'number' && Number.isFinite(src.no) ? src.no : Number.MAX_SAFE_INTEGER,
    });
  }
  items.sort((a, b) => a.savedNo - b.savedNo);
  return items.map((x, i) => ({ ...x.athlete, no: i + 1 }));
}

/** 저장값/백업 파일의 대진 배열 검증 — 손상된 매치는 버린다 (앱 크래시 방지). */
function normalizeMatches(raw: unknown): Match[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Match[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Partial<Match>;
    if (typeof m.id !== 'string' || !m.id) continue;
    if (typeof m.round !== 'number' || !Number.isFinite(m.round)) continue;
    if (typeof m.index !== 'number' || !Number.isFinite(m.index)) continue;
    out.push({
      id: m.id,
      round: m.round,
      index: m.index,
      a: typeof m.a === 'string' ? m.a : null,
      b: typeof m.b === 'string' ? m.b : null,
      scoreA: typeof m.scoreA === 'number' && Number.isFinite(m.scoreA) ? m.scoreA : null,
      scoreB: typeof m.scoreB === 'number' && Number.isFinite(m.scoreB) ? m.scoreB : null,
      winner: m.winner === 'A' || m.winner === 'B' ? m.winner : null,
      decided: m.decided === true,
      ...(typeof m.pairingA === 'number' ? { pairingA: m.pairingA } : {}),
      ...(typeof m.pairingB === 'number' ? { pairingB: m.pairingB } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

function normalizeEvents(saved: unknown): TEvent[] {
  const base = initialEvents();
  if (!Array.isArray(saved)) return base;
  return base.map((b) => {
    const s = (saved as TEvent[]).find((e) => e && e.id === b.id);
    if (!s) return b;
    return {
      ...b,
      ...s,
      scoreMode: s.scoreMode === 'sets' ? 'sets' : 'time',
      seedMode: s.seedMode === 'random' ? 'random' : 'order',
      // 2인 구형 데이터에는 pairings가 없어도 그대로 복구되고,
      // 3인 팀의 저장된 pairings는 순서를 바꾸지 않고 그대로 복구한다.
      teams: Array.isArray(s.teams)
        ? s.teams
            .filter((t): t is Team => !!t && typeof t === 'object' && typeof (t as Team).id === 'string')
            .map(withValidPairings)
        : [],
      excludedIds: Array.isArray(s.excludedIds)
        ? s.excludedIds.filter((id): id is string => typeof id === 'string')
        : [],
      matches: normalizeMatches(s.matches),
      currentMatchId: typeof s.currentMatchId === 'string' ? s.currentMatchId : null,
    };
  });
}

/**
 * 명단(참가자)과 종목 데이터의 정합성 복구.
 * - 명단에서 사라진 선수를 팀 구성 · 불참 목록 · 대진 참조에서 제거한다.
 * - 팀 구성이 실제로 바뀐 종목은 기존 대진표가 더 이상 유효하지 않으므로 초기화한다.
 *   (그대로 두면 '??' 이름의 유령 팀이 브래킷에 남는다)
 */
export function reconcileEvents(athletes: Athlete[], events: TEvent[]): TEvent[] {
  const ids = new Set(athletes.map((a) => a.id));
  return events.map((ev) => {
    const excludedIds = ev.excludedIds.filter((id) => ids.has(id));
    const excludedChanged = excludedIds.length !== ev.excludedIds.length;

    // 개인전 팀 id는 `ind-<선수 id>`로 명단에서 파생되므로 사라진 선수를 가리키는 대진표만 초기화한다.
    if (presetOf(ev.id).kind === 'individual') {
      const stale = !!ev.matches?.some((m) =>
        [m.a, m.b].some((tid) => !!tid && tid.startsWith('ind-') && !ids.has(tid.slice(4))),
      );
      if (!stale && !excludedChanged) return ev;
      return { ...ev, excludedIds, ...(stale ? { matches: null, currentMatchId: null } : {}) };
    }

    let teamsChanged = false;
    const teams = ev.teams.reduce<Team[]>((acc, t) => {
      const hadMembers = t.members.some(Boolean);
      const members = t.members.filter((id) => !id || ids.has(id));
      if (members.length !== t.members.length) teamsChanged = true;
      if (hadMembers && !members.some(Boolean)) {
        // 팀의 모든 선수가 명단에서 사라짐 → 팀 자체를 제거 (빈 슬롯만 있는 편집 중 팀은 유지)
        teamsChanged = true;
        return acc;
      }
      acc.push(members.length === t.members.length ? t : withValidPairings({ ...t, members }));
      return acc;
    }, []);

    if (!teamsChanged && !excludedChanged) return ev;
    return {
      ...ev,
      teams,
      excludedIds,
      ...(ev.matches ? { matches: null, currentMatchId: null } : {}),
    };
  });
}

/** 저장된 상태 복구. v2 키가 없으면 구버전(v1) 참가자 명단을 이관한다. */
function migrate(): AppState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<AppState>;
      const athletes = sanitizeAthletes(d.athletes);
      if (athletes) {
        const s = defaultState();
        return {
          ...s,
          athletes,
          events: reconcileEvents(athletes, normalizeEvents(d.events)),
          activeEventId: typeof d.activeEventId === 'string' ? d.activeEventId : s.activeEventId,
          step: d.step === 'brackets' || d.step === 'results' ? d.step : 'participants',
          projector: false,
          // 테마 필드가 없는 기존 저장 데이터는 라이트로 자연스럽게 이관된다.
          projectorTheme: normalizeProjectorTheme(d.projectorTheme),
        };
      }
    }
    const old = localStorage.getItem(LS_KEY_V1);
    if (old) {
      const d = JSON.parse(old) as { players?: { id?: string; no?: number; name?: string; gender?: string }[] };
      if (Array.isArray(d.players)) {
        const athletes: Athlete[] = d.players
          .map((p) => ({
            id: p.id ?? uid('a'),
            no: typeof p.no === 'number' ? p.no : 0,
            name: String(p.name ?? ''),
            gender: p.gender === 'F' ? ('F' as Gender) : ('M' as Gender),
          }))
          .filter((a) => a.name)
          .sort((x, y) => x.no - y.no);
        athletes.forEach((a, i) => (a.no = i + 1));
        if (athletes.length > 0) return { ...defaultState(), athletes };
      }
    }
  } catch {
    /* 손상된 저장값은 무시 */
  }
  return null;
}

export type Action =
  | { type: 'athlete/add'; name: string; gender: Gender }
  | { type: 'athlete/update'; id: string; name?: string; gender?: Gender }
  | { type: 'athlete/remove'; id: string }
  | { type: 'athlete/import'; list: Athlete[]; mode: 'replace' | 'append' }
  | { type: 'athlete/move'; id: string; dir: -1 | 1 }
  | { type: 'event/active'; id: string }
  | { type: 'event/scoreMode'; id: string; mode: ScoreMode }
  | { type: 'event/seedMode'; id: string; mode: SeedMode }
  | { type: 'event/exclude'; id: string; athleteId: string; excluded: boolean }
  | { type: 'event/teams'; id: string; teams: Team[] }
  | { type: 'event/reset'; id: string }
  | { type: 'event/generate'; id: string }
  | { type: 'event/reseedRandom'; id: string }
  | { type: 'team/shufflePairings'; id: string; teamId: string }
  | { type: 'match/score'; id: string; matchId: string; side: 'A' | 'B'; value: number | null }
  | { type: 'match/setResult'; id: string; matchId: string; winner: 'A' | 'B' | null; clearScores?: boolean }
  | { type: 'match/pairingNext'; id: string; matchId: string; side: 'A' | 'B' }
  | { type: 'match/current'; id: string; matchId: string | null }
  | { type: 'ui/projector'; on: boolean }
  | { type: 'ui/projectorTheme'; theme: ProjectorTheme }
  | { type: 'ui/projectorThemeToggle' }
  | { type: 'ui/step'; step: Step }
  | { type: 'backup/import'; data: AppState }
  | { type: 'reset/all' };

function renumber(list: Athlete[], start = 1): Athlete[] {
  return list.map((a, i) => ({ ...a, no: start + i }));
}

function withEvent(state: AppState, id: string, fn: (ev: TEvent) => TEvent): AppState {
  return { ...state, events: state.events.map((ev) => (ev.id === id ? fn(structuredClone(ev)) : ev)) };
}

function refreshCurrent(ev: TEvent): TEvent {
  if (!ev.matches) return ev;
  const valid = ev.matches.find((m) => m.id === ev.currentMatchId && !m.decided && m.a && m.b);
  return { ...ev, currentMatchId: valid ? valid.id : autoCurrentId(ev.matches) };
}

/** 팀 id → Team 맵 (3인 팀 출전 조합 순환 전파용). 개인전은 undefined */
function teamLookup(state: AppState, ev: TEvent): Map<string, Team> | undefined {
  const kind = presetOf(ev.id).kind;
  if (kind !== 'double') return undefined;
  return teamMap(getTeams(state.athletes, ev, kind));
}

/** 대진표 생성 — 현재 종목의 유효 팀으로 브래킷을 (재)생성한다. 팀이 2개 미만이면 그대로 둔다. */
function generateBracket(state: AppState, ev: TEvent, seedMode: SeedMode): TEvent {
  const teams = getTeams(state.athletes, ev, presetOf(ev.id).kind);
  if (teams.length < 2) return { ...ev, seedMode };
  const matches = buildMatches(teams, seedMode);
  return { ...ev, seedMode, matches, currentMatchId: autoCurrentId(matches) };
}

function setResult(
  ev: TEvent,
  matchId: string,
  winner: 'A' | 'B' | null,
  clearScores: boolean,
  teams?: Map<string, Team>,
): TEvent {
  if (!ev.matches) return ev;
  const matches = ev.matches.map((m) =>
    m.id === matchId
      ? {
          ...m,
          decided: winner !== null,
          winner,
          ...(clearScores ? { scoreA: null, scoreB: null } : {}),
        }
      : m,
  );
  return refreshCurrent({ ...ev, matches: propagate(matches, teams) });
}

export function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case 'athlete/add': {
      const name = a.name.trim();
      if (!name) return state;
      const maxNo = state.athletes.reduce((mx, x) => Math.max(mx, x.no), 0);
      return { ...state, athletes: [...state.athletes, { id: uid('a'), no: maxNo + 1, name, gender: a.gender }] };
    }
    case 'athlete/update':
      return {
        ...state,
        athletes: state.athletes.map((x) =>
          x.id === a.id ? { ...x, name: a.name?.trim() || x.name, gender: a.gender ?? x.gender } : x,
        ),
      };
    case 'athlete/remove': {
      // 선수가 빠진 팀은 pairings를 재정규화하고, 팀 구성이 바뀐 종목의 대진표는 초기화한다.
      const athletes = renumber(state.athletes.filter((x) => x.id !== a.id));
      return { ...state, athletes, events: reconcileEvents(athletes, state.events) };
    }
    case 'athlete/import': {
      // replace: 새 명단 1..n / append: 기존 번호를 그대로 두고 이어서 번호를 매긴다.
      // (예전에는 append에서도 기존 참가자의 번호를 새로 매겨 시드 순서가 뒤바뀌었다)
      const athletes =
        a.mode === 'replace'
          ? renumber(a.list, 1)
          : [
              ...state.athletes,
              ...renumber(a.list, state.athletes.reduce((mx, x) => Math.max(mx, x.no), 0) + 1),
            ];
      return { ...state, athletes, events: reconcileEvents(athletes, state.events) };
    }
    case 'athlete/move': {
      const list = [...state.athletes];
      const i = list.findIndex((x) => x.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= list.length) return state;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...state, athletes: renumber(list) };
    }
    case 'event/active':
      return { ...state, activeEventId: a.id };
    case 'event/scoreMode':
      return withEvent(state, a.id, (ev) => ({ ...ev, scoreMode: a.mode }));
    case 'event/seedMode':
      return withEvent(state, a.id, (ev) => ({ ...ev, seedMode: a.mode }));
    case 'event/exclude':
      return withEvent(state, a.id, (ev) => ({
        ...ev,
        excludedIds: a.excluded
          ? [...new Set([...ev.excludedIds, a.athleteId])]
          : ev.excludedIds.filter((x) => x !== a.athleteId),
      }));
    case 'event/teams':
      return withEvent(state, a.id, (ev) => ({
        ...ev,
        // 빈 슬롯('')은 압축하고, 3인 팀의 pairings는 구성원 기준으로 유지/재생성한다.
        teams: a.teams.map(withValidPairings),
      }));
    case 'event/reset':
      return withEvent(state, a.id, (ev) => ({ ...ev, matches: null, currentMatchId: null }));
    case 'event/generate':
      return withEvent(state, a.id, (ev) => generateBracket(state, ev, ev.seedMode));
    case 'event/reseedRandom':
      // 🎲 대진 무작위 재배치 — 시드 모드를 random으로 바꾸고 대진표를 새로 만든다.
      // (진행/결과는 사라지며, 호출부에서 확인 다이얼로그를 거친다)
      return withEvent(state, a.id, (ev) => generateBracket(state, ev, 'random'));
    case 'team/shufflePairings':
      // 🔀 3인 팀의 출전 조합 순서만 무작위로 다시 섞는다 (조합 집합 AB·BC·AC는 그대로).
      // 상태는 팀 데이터에만 저장되므로 불러올 때마다 렌더 결과가 동일하다.
      return withEvent(state, a.id, (ev) => ({
        ...ev,
        teams: ev.teams
          .map((t) =>
            t.id === a.teamId && t.pairings && t.pairings.length > 1
              ? { ...t, pairings: shufflePairings(t.pairings) }
              : t,
          )
          .map(withValidPairings),
      }));
    case 'match/score':
      return withEvent(state, a.id, (ev) => {
        if (!ev.matches) return ev;
        const matches = ev.matches.map((m) =>
          m.id === a.matchId
            ? { ...m, [a.side === 'A' ? 'scoreA' : 'scoreB']: a.value }
            : m,
        );
        const target = matches.find((m) => m.id === a.matchId);
        const nextEv: TEvent = { ...ev, matches };
        // 양쪽 기록이 모두 입력되면 자동으로 승자를 판정한다 (짧은 기록/많은 세트 승리).
        // 동률이거나 미결정 경기의 수동 승자 지정은 그대로 둔다.
        if (!target || target.decided) return nextEv;
        const w = decideFromScores(target, ev.scoreMode);
        return w ? setResult(nextEv, a.matchId, w, false, teamLookup(state, ev)) : nextEv;
      });
    case 'match/setResult':
      return withEvent(state, a.id, (ev) =>
        setResult(ev, a.matchId, a.winner, !!a.clearScores, teamLookup(state, ev)),
      );
    case 'match/pairingNext':
      return withEvent(state, a.id, (ev) => {
        if (!ev.matches) return ev;
        const m = ev.matches.find((x) => x.id === a.matchId);
        if (!m || m.decided) return ev;
        const tid = a.side === 'A' ? m.a : m.b;
        if (!tid) return ev;
        const team = teamLookup(state, ev)?.get(tid);
        if (!team?.pairings || team.pairings.length === 0) return ev;
        const key = a.side === 'A' ? 'pairingA' : 'pairingB';
        return {
          ...ev,
          matches: ev.matches.map((x) =>
            x.id === a.matchId ? { ...x, [key]: ((x[key] ?? 0) + 1) % team.pairings!.length } : x,
          ),
        };
      });
    case 'match/current':
      return withEvent(state, a.id, (ev) => ({ ...ev, currentMatchId: a.matchId }));
    case 'ui/projector':
      return { ...state, projector: a.on };
    case 'ui/projectorTheme':
      return { ...state, projectorTheme: normalizeProjectorTheme(a.theme) };
    case 'ui/projectorThemeToggle':
      return { ...state, projectorTheme: toggleProjectorTheme(state.projectorTheme) };
    case 'ui/step':
      return { ...state, step: a.step };
    case 'backup/import': {
      // 가져온 데이터는 projector를 끄고 테마를 정규화해서 반영한다.
      return {
        ...a.data,
        projector: false,
        projectorTheme: normalizeProjectorTheme(a.data.projectorTheme),
      };
    }
    case 'reset/all':
      return defaultState();
  }
}

/** 백업 파일(JSON)을 파싱해 migrate + normalizeEvents 를 거친 AppState 로 정제한다. */
export function restoreFromJSON(raw: string): AppState | null {
  try {
    const d = JSON.parse(raw) as Partial<AppState>;
    if (!d || typeof d !== 'object' || !Array.isArray(d.athletes)) return null;
    const s = defaultState();
    const athletes = sanitizeAthletes(d.athletes);
    if (!athletes) return null;
    const restored: AppState = {
      ...s,
      athletes,
      events: reconcileEvents(athletes, normalizeEvents(d.events)),
      activeEventId: typeof d.activeEventId === 'string' ? d.activeEventId : s.activeEventId,
      step: d.step === 'brackets' || d.step === 'results' ? d.step : 'participants',
      projector: false,
      projectorTheme: normalizeProjectorTheme(d.projectorTheme),
    };
    return restored;
  } catch {
    return null;
  }
}

/** 내보내기용 JSON 문자열 (projector 필드 제외) */
export function serializeState(state: AppState): string {
  const { projector: _p, ...persist } = state;
  void _p;
  return JSON.stringify(persist, null, 2);
}

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  saveError: boolean;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => migrate() ?? defaultState());
  const [saveError, setSaveError] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // LocalStorage 자동 저장 (디바운스) — 새로고침/브라우저 종료 후에도 유지
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const { projector, ...persist } = stateRef.current;
        void projector;
        localStorage.setItem(LS_KEY, JSON.stringify(persist));
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [state]);

  // 탭을 닫거나 백그라운드로 보낼 때 마지막 입력까지 즉시 저장한다.
  // (디바운스 200ms 사이에 창을 닫으면 마지막 조작이 사라질 수 있었다)
  useEffect(() => {
    const flush = () => {
      try {
        const { projector, ...persist } = stateRef.current;
        void projector;
        localStorage.setItem(LS_KEY, JSON.stringify(persist));
      } catch {
        /* 저장 실패는 다음 디바운스 저장에서 재시도된다 */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <StoreCtx.Provider value={{ state, dispatch, saveError }}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
