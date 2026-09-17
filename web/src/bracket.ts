import { Match, ScoreMode, SeedMode, Team, TeamPairing } from './types';

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
  const pairCount = size / 2;
  const byeCount = size - n;
  const pattern = seedPattern(size);
  const slots: (string | null)[] = Array(size).fill(null);

  // BYE는 한 매치에 하나만 두고, 1라운드 전체에 등간격으로 배치한다.
  // random 모드에서는 같은 수의 매치 위치만 무작위로 뽑는다.
  const byePairs =
    seedMode === 'order'
      ? Array.from({ length: byeCount }, (_, i) => Math.floor((i * pairCount) / byeCount))
      : shuffle(Array.from({ length: pairCount }, (_, i) => i)).slice(0, byeCount);
  if (seedMode === 'order') {
    const reservedSlots = new Set<number>();

    // 상위 시드는 BYE 매치의 더 높은 슬롯(시드 패턴 값이 작은 쪽)에 배치한다.
    byePairs.forEach((pair, i) => {
      const left = pair * 2;
      const right = left + 1;
      const seedSlot = pattern[left] < pattern[right] ? left : right;
      slots[seedSlot] = teams[i].id;
      reservedSlots.add(left);
      reservedSlots.add(right);
    });

    // BYE가 없는 매치의 슬롯을 시드 순으로 채워 기존 표준 시드 패턴을 유지한다.
    const openSlots = Array.from({ length: size }, (_, slot) => slot)
      .filter((slot) => !reservedSlots.has(slot))
      .sort((a, b) => pattern[a] - pattern[b]);
    teams.slice(byeCount).forEach((team, i) => {
      slots[openSlots[i]] = team.id;
    });
  } else {
    const byeSlots = new Set<number>();
    const playableSlots: number[] = [];

    // BYE 위치(좌/우)는 매치마다 따로 무작위로 정하고, 나머지 슬롯에는 셔플한 팀을 채운다.
    byePairs.forEach((pair) => {
      const left = pair * 2;
      const right = left + 1;
      const byeSlot = Math.random() < 0.5 ? left : right;
      byeSlots.add(byeSlot);
      playableSlots.push(byeSlot === left ? right : left);
    });
    for (let slot = 0; slot < size; slot++) {
      if (!byeSlots.has(slot) && !playableSlots.includes(slot)) playableSlots.push(slot);
    }
    shuffle(teams).forEach((team, i) => {
      slots[playableSlots[i]] = team.id;
    });
  }

  const matches: Match[] = [];
  const byId = new Map(teams.map((t) => [t.id, t]));
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
        // 3인 팀의 첫 경기는 첫 번째 남은 출전 조합(인덱스 0)으로 시작한다.
        if (m.a && (byId.get(m.a)?.pairings?.length ?? 0) > 0) m.pairingA = 0;
        if (m.b && (byId.get(m.b)?.pairings?.length ?? 0) > 0) m.pairingB = 0;
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
  return propagate(matches, byId);
}

/**
 * 다음 라운드로 진출하는 팀의 출전 조합 인덱스.
 * - 2인 팀(또는 팀 정보가 없으면): undefined (조합 개념 없음)
 * - 3인 팀: 실경기를 치르고 올라오면 (이전 인덱스 + 1) mod 3으로 순환한다.
 *   부전승(BYE) 매치는 실경기가 아니므로 조합을 소진하지 않고 그대로 가져간다.
 */
function advancingPairing(prev: Match | undefined, teams?: Map<string, Team>): number | undefined {
  if (!prev || !prev.winner) return undefined;
  const teamId = prev.winner === 'A' ? prev.a : prev.b;
  const team = teamId ? teams?.get(teamId) : undefined;
  if (!team || !team.pairings || team.pairings.length === 0) return undefined;
  const prevIdx = prev.winner === 'A' ? prev.pairingA : prev.pairingB;
  const base = prevIdx ?? 0;
  const wasBye = !prev.a || !prev.b;
  return wasBye ? base : (base + 1) % team.pairings.length;
}

/**
 * 반응형 전파: 이전 라운드 승자로 다음 라운드 슬롯을 채우고,
 * 한쪽이 사라진(롤백된) 매치는 점수·결과를 초기화한다.
 * teams(팀 id → Team)가 주어지면 3인 팀의 출전 조합 인덱스도 함께 순환 전파한다.
 */
export function propagate(matches: Match[], teams?: Map<string, Team>): Match[] {
  const byRM = new Map<string, Match>();
  for (const m of matches) byRM.set(`${m.round}:${m.index}`, m);
  for (const m of matches) {
    if (m.round === 0) continue;
    const la = byRM.get(`${m.round - 1}:${m.index * 2}`);
    const lb = byRM.get(`${m.round - 1}:${m.index * 2 + 1}`);
    m.a = la && la.winner ? (la.winner === 'A' ? la.a : la.b) : null;
    m.b = lb && lb.winner ? (lb.winner === 'A' ? lb.a : lb.b) : null;
    m.pairingA = advancingPairing(la, teams);
    m.pairingB = advancingPairing(lb, teams);
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

/* ------------------------- 3인 팀 출전 조합 ------------------------- */

/**
 * 3인 팀(A, B, C)의 2인 출전 조합 3개 — [A+B, B+C, A+C].
 * 규칙: 세 조합을 정확히 한 번씩 사용, 중복 없음, A/B/C가 각각 정확히 2회 포함.
 */
export function trioPairings(members: string[]): TeamPairing[] {
  const [a, b, c] = members;
  return [[a, b], [b, c], [a, c]];
}

/** 조합의 순서만 무작위로 섞은 사본 (집합은 그대로 유지) */
export function shufflePairings(pairings: TeamPairing[]): TeamPairing[] {
  return shuffle(pairings);
}

/**
 * pairings가 members(3명)의 세 조합을 정확히 커버하는가.
 * - 정확히 3개 · 중복 없음 · 양쪽 모두 구성원 · 자기 자신과의 조합 금지
 */
export function pairingsCover(pairings: TeamPairing[], members: string[]): boolean {
  if (pairings.length !== 3) return false;
  const set = new Set(members);
  const seen = new Set<string>();
  for (const [x, y] of pairings) {
    if (x === y || !set.has(x) || !set.has(y)) return false;
    const key = [x, y].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return seen.size === 3;
}

/**
 * 팀의 pairings를 members 기준으로 유효하게 유지 (정규화).
 * - 3인 팀: 기존 pairings가 구성원을 정확히 커버하면 그대로(순서 포함) 유지 —
 *   이름 변경·순서 변경·새로고침에서 순서가 흔들리지 않는다. 커버하지 못하면 폐기 후 재생성.
 * - 2인 이하 팀: pairings 제거 (2인 팀은 조합 개념이 없다). size=3 슬롯 의도는 유지.
 */
export function withValidPairings(team: Team): Team {
  const members = (Array.isArray(team.members) ? team.members : []).filter(Boolean);
  if (members.length >= 3) {
    const trio = members.slice(0, 3);
    const saved = Array.isArray(team.pairings) ? team.pairings : undefined;
    const pairings = saved && pairingsCover(saved, trio) ? saved : trioPairings(trio);
    return { ...team, members: trio, size: 3, pairings };
  }
  return {
    ...team,
    members,
    ...(team.size === 3 ? { size: 3 as const } : {}),
    pairings: undefined,
  };
}

/* ------------------------------ 자동 페어링 ------------------------------ */

export interface PairGroups {
  /** 팀별 선수 id 배열 — 2인 또는 3인 팀 */
  groups: string[][];
  /** 정상 입력(총 2명 이상)에서는 항상 빈 배열 */
  leftover: string[];
}

/**
 * 더블 자동 페어링 — 기본 2인 팀, 홀수 인원은 3인 팀으로 흡수해 어느 선수도 남기지 않는다.
 *
 * [same — 같은 성별 우선] (참가자/시드 순서 유지, 셔플 없음)
 *  - 각 성별 그룹을 따로 처리: 짝수면 2인 팀들, 홀수(3명 이상)면 같은 성별 3인 팀 1개 + 나머지 2인 팀.
 *  - 성별 인원이 1명인 예외: leftover 1명을 기존 2인 팀에 합쳐 3인 혼합 팀(상대 성별 팀 우선).
 *  - 2인 팀이 하나도 없으면 3인 팀을 분해해 2인 팀 2개로 재편 (총 4명 케이스).
 *  - 남1+여1로 총 2명뿐이면 2인 혼성 팀 허용.
 *
 * [any — 무작위] 전체를 셔플한 뒤, 홀수(3명 이상)면 3인 팀 1개 + 나머지 2인 팀.
 */
export function autoPairGroups(
  pool: { id: string; gender?: 'M' | 'F' }[],
  mode: 'same' | 'any',
): PairGroups {
  if (mode === 'any') {
    const s = shuffle(pool.map((p) => p.id));
    const groups: string[][] = [];
    let i = 0;
    if (s.length % 2 === 1 && s.length >= 3) {
      groups.push([s[0], s[1], s[2]]);
      i = 3;
    }
    for (; i + 1 < s.length; i += 2) groups.push([s[i], s[i + 1]]);
    // 총 1명뿐인 비정상 입력만 leftover로 넘긴다
    return { groups, leftover: i < s.length ? [s[i]] : [] };
  }

  const males = pool.filter((p) => p.gender === 'M');
  const females = pool.filter((p) => p.gender !== 'M');

  /** 한 성별 그룹을 3인(홀수 ≥3) + 2인 팀들로 자른다. 1명뿐이면 leftover. */
  const chunkGender = (list: { id: string; gender?: 'M' | 'F' }[]) => {
    const groups: string[][] = [];
    const leftover: string[] = [];
    if (list.length === 1) {
      leftover.push(list[0].id);
      return { groups, leftover };
    }
    let i = 0;
    if (list.length % 2 === 1) {
      groups.push([list[0].id, list[1].id, list[2].id]);
      i = 3;
    }
    for (; i + 1 < list.length; i += 2) groups.push([list[i].id, list[i + 1].id]);
    return { groups, leftover };
  };

  const m = chunkGender(males);
  const f = chunkGender(females);
  let leftover = [...m.leftover, ...f.leftover];

  if (leftover.length === 2) {
    // 남1 + 여1 = 총 2명 → 2인 혼성 팀 허용
    m.groups.push(leftover);
    leftover = [];
  } else if (leftover.length === 1) {
    const solo = leftover[0];
    const soloM = males.some((p) => p.id === solo);
    const own = soloM ? m.groups : f.groups;
    const other = soloM ? f.groups : m.groups;
    const pairIdx = (arr: string[][]) => arr.findIndex((g) => g.length === 2);
    let target = other; // 상대 성별 2인 팀 우선
    let idx = pairIdx(other);
    if (idx < 0) {
      target = own;
      idx = pairIdx(own);
    }
    if (idx >= 0) {
      // leftover 1명 + 기존 2인 팀 → 3인 혼합 팀 (예: 남1 + 여2)
      target.splice(idx, 1, [...target[idx], solo]);
      leftover = [];
    } else {
      // 2인 팀이 전혀 없음: 3인 팀이 있으면 분해해서 2인 팀 2개 (총 4명 케이스)
      const trioIdx = (arr: string[][]) => arr.findIndex((g) => g.length === 3);
      let target = own;
      idx = trioIdx(own);
      if (idx < 0) {
        target = other;
        idx = trioIdx(other);
      }
      if (idx >= 0) {
        const trio = target.splice(idx, 1)[0];
        target.push([trio[0], trio[1]], [solo, trio[2]]);
        leftover = [];
      }
      // 그래도 안 되면(총 1명뿐) leftover 그대로 반환
    }
  }

  return { groups: [...m.groups, ...f.groups], leftover };
}
