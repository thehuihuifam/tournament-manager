import { Match, ScoreMode, SeedMode, Team } from './types';

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

/**
 * 표준 power-of-2 시드 패턴. slots[i] = i번째 슬롯에 들어갈 시드 값(1始まり).
 * 예: 8 → [1,8,4,5,2,7,3,6]
 * 성질: 각 매치 슬롯 쌍 (a,b)는 a+b = size+1 이므로, 상위 시드(1..n)와
 * 부전승 슬롯(n+1..size)끼리 한 매치에 모이는 일은 절대 발생하지 않는다.
 */
export function seedPattern(size: number): number[] {
  let arr = [1, 2];
  while (arr.length < size) {
    const s = arr.length * 2;
    const next: number[] = [];
    for (const v of arr) next.push(v, s + 1 - v);
    arr = next;
  }
  return arr;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 싱글 엘리미네이션 브래킷 생성.
 * - 'order': 참가 순서(시드) 배치. 2^n 이 아닌 팀 수에겐 BYE가 상위 시드에게 공정하게 자동 배치됨.
 * - 'random': 무작위 배치.
 * BYE 매치는 생성 즉시 자동 승리로 판정한다.
 */
export function buildMatches(teams: Team[], seedMode: SeedMode): Match[] {
  const n = teams.length;
  const size = nextPow2(n);
  const rounds = Math.round(Math.log2(size));
  const slots: (string | null)[] = Array(size).fill(null);

  if (seedMode === 'order') {
    const pattern = seedPattern(size);
    pattern.forEach((seedVal, slot) => {
      const idx = seedVal - 1;
      if (idx < n) slots[slot] = teams[idx].id;
    });
  } else {
    const order = shuffle(teams);
    for (let i = 0; i < n; i++) slots[i] = order[i].id;
  }

  const matches: Match[] = [];
  for (let r = 0; r < rounds; r++) {
    const count = size >> (r + 1);
    for (let i = 0; i < count; i++) {
      const m: Match = {
        id: `r${r}-m${i}`,
        round: r,
        index: i,
        a: r === 0 ? slots[2 * i] : null,
        b: r === 0 ? slots[2 * i + 1] : null,
        scoreA: null,
        scoreB: null,
        winner: null,
        decided: false,
      };
      if (r === 0) {
        if (m.a === null && m.b !== null) {
          m.winner = 'B';
          m.decided = true;
        } else if (m.b === null && m.a !== null) {
          m.winner = 'A';
          m.decided = true;
        }
      }
      matches.push(m);
    }
  }
  return propagate(matches);
}

/**
 * 반응형 전파: 이전 라운드 승자로 다음 라운드 슬롯을 채우고,
 * 한쪽이 사라진(롤백된) 매치는 점수·결과를 초기화한다.
 */
export function propagate(matches: Match[]): Match[] {
  const byRM = new Map<string, Match>();
  for (const m of matches) byRM.set(`${m.round}:${m.index}`, m);
  for (const m of matches) {
    if (m.round === 0) continue;
    const la = byRM.get(`${m.round - 1}:${m.index * 2}`);
    const lb = byRM.get(`${m.round - 1}:${m.index * 2 + 1}`);
    m.a = la && la.winner ? (la.winner === 'A' ? la.a : la.b) : null;
    m.b = lb && lb.winner ? (lb.winner === 'A' ? lb.a : lb.b) : null;
    if (!m.a || !m.b) {
      m.winner = null;
      m.decided = false;
      m.scoreA = null;
      m.scoreB = null;
    }
  }
  return matches;
}

/** 현재 점수로 승자 계산. 동률/미입력이면 null */
export function decideFromScores(m: Match, mode: ScoreMode): 'A' | 'B' | null {
  if (m.scoreA == null || m.scoreB == null) return null;
  if (mode === 'time') {
    if (m.scoreA < m.scoreB) return 'A';
    if (m.scoreB < m.scoreA) return 'B';
    return null;
  }
  if (m.scoreA > m.scoreB) return 'A';
  if (m.scoreB > m.scoreA) return 'B';
  return null;
}

/** 아직 미결정이고 양쪽 출전 팀이 있는 첫 매치 (라운드 순) */
export function autoCurrentId(matches: Match[]): string | null {
  for (const m of matches) if (!m.decided && m.a && m.b) return m.id;
  return null;
}

export function effectiveCurrentId(ev: { matches: Match[] | null; currentMatchId: string | null }): string | null {
  if (!ev.matches) return null;
  const cur = ev.matches.find((m) => m.id === ev.currentMatchId && !m.decided && m.a && m.b);
  if (cur) return cur.id;
  return autoCurrentId(ev.matches);
}

export function matchListByRound(matches: Match[]): Match[][] {
  const rounds = matches.reduce((mx, m) => Math.max(mx, m.round + 1), 0);
  const out: Match[][] = Array.from({ length: rounds }, () => []);
  for (const m of [...matches].sort((x, y) => x.round - y.round || x.index - y.index)) out[m.round].push(m);
  return out;
}

export interface PodiumResult {
  winner: string;
  runnerUp: string | null;
  third: string[]; // 준결승 패자 (최대 2명, 공동 3위)
}

export function podium(matches: Match[]): PodiumResult | null {
  const rounds = matches.reduce((mx, m) => Math.max(mx, m.round + 1), 0);
  const final = matches.find((m) => m.round === rounds - 1);
  if (!final || !final.decided || !final.winner) return null;
  const wTeam = final.winner === 'A' ? final.a : final.b;
  const lTeam = final.winner === 'A' ? final.b : final.a;
  const third: string[] = [];
  if (rounds >= 2) {
    for (const sf of matches.filter((m) => m.round === rounds - 2)) {
      if (sf.decided && sf.winner) {
        const loser = sf.winner === 'A' ? sf.b : sf.a;
        if (loser) third.push(loser);
      }
    }
  }
  return { winner: wTeam ?? '', runnerUp: lTeam, third };
}

/**
 * 더블 자동 페어링.
 * - 'same': 성별별로 그룹지어 인접 2명을 짝짓기 (남-남 / 여-여 팀. 홀수 남은 선수는 leftover)
 * - 'any' : 전체를 무작위로 섞은 뒤 짝짓기.
 */
export function autoPair(
  pool: { id: string; gender?: 'M' | 'F' }[],
  mode: 'same' | 'any',
): { pairs: [string, string][]; leftover: string[] } {
  const pairs: [string, string][] = [];
  const leftover: string[] = [];
  const groupPair = (list: { id: string }[]) => {
    for (let i = 0; i < list.length; i += 2) {
      if (i + 1 < list.length) pairs.push([list[i].id, list[i + 1].id]);
      else leftover.push(list[i].id);
    }
  };
  if (mode === 'any') {
    groupPair(shuffle(pool));
  } else {
    groupPair(pool.filter((p) => p.gender === 'M'));
    groupPair(pool.filter((p) => p.gender === 'F'));
  }
  return { pairs, leftover };
}
