import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import {
  AppState,
  Athlete,
  Gender,
  ScoreMode,
  SeedMode,
  Step,
  Team,
  TEvent,
} from './types';
import { PRESETS, getTeams, initialEvents, presetOf } from './presets';
import {
  autoCurrentId,
  buildMatches,
  decideFromScores,
  propagate,
} from './bracket';
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
  };
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
      teams: Array.isArray(s.teams) ? s.teams : [],
      excludedIds: Array.isArray(s.excludedIds) ? s.excludedIds : [],
      matches: Array.isArray(s.matches) ? s.matches : null,
    };
  });
}

/** 저장된 상태 복구. v2 키가 없으면 구버전(v1) 참가자 명단을 이관한다. */
function migrate(): AppState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<AppState>;
      if (Array.isArray(d.athletes)) {
        const s = defaultState();
        return {
          ...s,
          athletes: d.athletes,
          events: normalizeEvents(d.events),
          activeEventId: typeof d.activeEventId === 'string' ? d.activeEventId : s.activeEventId,
          step: d.step === 'brackets' || d.step === 'results' ? d.step : 'participants',
          projector: false,
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
  | { type: 'match/score'; id: string; matchId: string; side: 'A' | 'B'; value: number | null }
  | { type: 'match/setResult'; id: string; matchId: string; winner: 'A' | 'B' | null; clearScores?: boolean }
  | { type: 'match/decide'; id: string; matchId: string }
  | { type: 'match/current'; id: string; matchId: string | null }
  | { type: 'ui/projector'; on: boolean }
  | { type: 'ui/step'; step: Step }
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

function setResult(ev: TEvent, matchId: string, winner: 'A' | 'B' | null, clearScores: boolean): TEvent {
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
  return refreshCurrent({ ...ev, matches: propagate(matches) });
}

function reducer(state: AppState, a: Action): AppState {
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
    case 'athlete/remove':
      return {
        ...state,
        athletes: state.athletes
          .filter((x) => x.id !== a.id)
          .map((x, i) => ({ ...x, no: i + 1 })),
        events: state.events.map((ev) => {
          const teams = ev.teams
            .map((t) => ({ ...t, members: t.members.filter((m) => m !== a.id) }))
            .filter((t) => t.members.length === 2);
          return { ...ev, teams };
        }),
      };
    case 'athlete/import': {
      const base = a.mode === 'replace' ? [] : state.athletes;
      const startNo = base.reduce((mx, x) => Math.max(mx, x.no), 0) + 1;
      return { ...state, athletes: renumber([...base, ...a.list], startNo) };
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
        teams: a.teams.map((t) => ({ ...t, members: t.members.filter(Boolean) })),
      }));
    case 'event/reset':
      return withEvent(state, a.id, (ev) => ({ ...ev, matches: null, currentMatchId: null }));
    case 'event/generate':
      return withEvent(state, a.id, (ev) => {
        const teams = getTeams(state.athletes, ev, presetOf(ev.id).kind);
        if (teams.length < 2) return ev;
        const matches = buildMatches(teams, ev.seedMode);
        return { ...ev, matches, currentMatchId: autoCurrentId(matches) };
      });
    case 'match/score':
      return withEvent(state, a.id, (ev) => {
        if (!ev.matches) return ev;
        const matches = ev.matches.map((m) =>
          m.id === a.matchId
            ? { ...m, [a.side === 'A' ? 'scoreA' : 'scoreB']: a.value }
            : m,
        );
        return { ...ev, matches };
      });
    case 'match/setResult':
      return withEvent(state, a.id, (ev) => setResult(ev, a.matchId, a.winner, !!a.clearScores));
    case 'match/decide': {
      const ev = state.events.find((e) => e.id === a.id);
      if (!ev?.matches) return state;
      const m = ev.matches.find((x) => x.id === a.matchId);
      if (!m) return state;
      const w = decideFromScores(m, ev.scoreMode);
      if (!w) return state;
      return withEvent(state, a.id, (e) => setResult(e, a.matchId, w, false));
    }
    case 'match/current':
      return withEvent(state, a.id, (ev) => ({ ...ev, currentMatchId: a.matchId }));
    case 'ui/projector':
      return { ...state, projector: a.on };
    case 'ui/step':
      return { ...state, step: a.step };
    case 'reset/all':
      return defaultState();
  }
}

interface Ctx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => migrate() ?? defaultState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // LocalStorage 자동 저장 (디바운스) — 새로고침/브라우저 종료 후에도 유지
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const { projector, ...persist } = stateRef.current;
        void projector;
        localStorage.setItem(LS_KEY, JSON.stringify(persist));
      } catch {
        /* 저장 실패 무시 */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [state]);

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
