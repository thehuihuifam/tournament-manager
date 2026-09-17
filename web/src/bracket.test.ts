import { describe, expect, it } from 'vitest';
import {
  autoPairGroups,
  buildMatches,
  pairingsCover,
  propagate,
  seedPattern,
  shufflePairings,
  trioPairings,
  withValidPairings,
} from './bracket';
import { getTeams, teamMap } from './presets';
import { Athlete, Team, TeamPairing, TEvent } from './types';

function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    name: `팀 ${i + 1}`,
    members: [`athlete-${i + 1}`],
  }));
}

function firstRound(count: number): ReturnType<typeof buildMatches> {
  return buildMatches(makeTeams(count), 'order').filter((m) => m.round === 0);
}

describe('buildMatches BYE distribution', () => {
  it('places the top seed on the only BYE for three teams', () => {
    const matches = firstRound(3);

    expect(matches.filter((m) => m.a === null || m.b === null)).toHaveLength(1);
    expect(matches[0]).toMatchObject({ a: 'team-1', b: null, winner: 'A', decided: true });
    expect(new Set([matches[1].a, matches[1].b])).toEqual(new Set(['team-2', 'team-3']));
  });

  it('spreads three BYEs and sends seeds 1 through 3 directly onward', () => {
    const matches = firstRound(5);
    const byeMatches = matches.filter((m) => m.a === null || m.b === null);

    expect(byeMatches).toHaveLength(3);
    expect(new Set(byeMatches.map((m) => m.index))).toEqual(new Set([0, 1, 2]));
    expect(byeMatches.every((m) => m.a !== null || m.b !== null)).toBe(true);
    expect(
      byeMatches.map((m) => (m.winner === 'A' ? m.a : m.b)).sort(),
    ).toEqual(['team-1', 'team-2', 'team-3']);
    expect(new Set([matches[3].a, matches[3].b])).toEqual(new Set(['team-4', 'team-5']));
  });

  it('uses exact evenly-spread BYE matches for 27 teams', () => {
    const matches = firstRound(27);
    const byeMatches = matches.filter((m) => m.a === null || m.b === null);

    expect(matches).toHaveLength(16);
    expect(byeMatches.map((m) => m.index)).toEqual([0, 3, 6, 9, 12]);
    expect(byeMatches.every((m) => m.a !== null || m.b !== null)).toBe(true);
    expect(byeMatches.map((m) => (m.winner === 'A' ? m.a : m.b))).toEqual([
      'team-1',
      'team-2',
      'team-3',
      'team-4',
      'team-5',
    ]);
    expect(matches.every((m) => m.a !== null || m.b !== null)).toBe(true);
  });

  it('keeps five random BYEs on distinct playable matches without BYE-BYE', () => {
    for (let i = 0; i < 100; i += 1) {
      const matches = buildMatches(makeTeams(27), 'random').filter((m) => m.round === 0);
      const byeMatches = matches.filter((m) => m.a === null || m.b === null);

      expect(byeMatches).toHaveLength(5);
      expect(new Set(byeMatches.map((m) => m.index)).size).toBe(5);
      expect(byeMatches.every((m) => m.a !== null || m.b !== null)).toBe(true);
      expect(matches.every((m) => m.a !== null || m.b !== null)).toBe(true);
    }
  });
});

describe('buildMatches standard seed pattern regression', () => {
  it('keeps the standard pairings for power-of-two fields from 4 through 256', () => {
    for (let exponent = 2; exponent <= 8; exponent += 1) {
      const size = 2 ** exponent;
      const matches = firstRound(size);
      const pattern = seedPattern(size);

      expect(matches).toHaveLength(size / 2);
      matches.forEach((match, index) => {
        expect([match.a, match.b]).toEqual([
          `team-${pattern[index * 2]}`,
          `team-${pattern[index * 2 + 1]}`,
        ]);
      });
    }
  });

  it('keeps the familiar 1-versus-8 and 4-versus-5 pairings', () => {
    const matches = firstRound(8);

    expect([matches[0].a, matches[0].b]).toEqual(['team-1', 'team-8']);
    expect([matches[1].a, matches[1].b]).toEqual(['team-4', 'team-5']);
  });
});

/* ============================ 더블 자동 페어링 (3인 팀) ============================ */

function poolOf(ids: string[], genders?: ('M' | 'F')[]): { id: string; gender: 'M' | 'F' }[] {
  return ids.map((id, i) => ({ id, gender: genders ? genders[i] : 'M' }));
}

const sizesOf = (groups: string[][]) => groups.map((g) => g.length);

describe('autoPairGroups 같은 성별 페어링 — 홀수 인원은 3인 팀으로 흡수', () => {
  it('같은 성별 3명 → 3인 팀 1개, leftover 0명', () => {
    const { groups, leftover } = autoPairGroups(poolOf(['m1', 'm2', 'm3']), 'same');
    expect(groups).toEqual([['m1', 'm2', 'm3']]);
    expect(leftover).toEqual([]);
  });

  it('같은 성별 5명 → 3인 팀 1개 + 2인 팀 1개, leftover 0명', () => {
    const { groups, leftover } = autoPairGroups(poolOf(['m1', 'm2', 'm3', 'm4', 'm5']), 'same');
    expect(sizesOf(groups)).toEqual([3, 2]);
    expect(sizesOf(groups).reduce((s, n) => s + n, 0)).toBe(5);
    expect(leftover).toEqual([]);
  });

  it('같은 성별 7명 → 3인 팀 1개 + 2인 팀 2개, leftover 0명', () => {
    const { groups, leftover } = autoPairGroups(
      poolOf(['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']),
      'same',
    );
    expect(sizesOf(groups)).toEqual([3, 2, 2]);
    expect(leftover).toEqual([]);
  });

  it('남자 3명 + 여자 3명 → 남 3인 팀 1개 + 여 3인 팀 1개, leftover 0명', () => {
    const { groups, leftover } = autoPairGroups(
      poolOf(['m1', 'm2', 'm3', 'f1', 'f2', 'f3'], ['M', 'M', 'M', 'F', 'F', 'F']),
      'same',
    );
    expect(groups).toHaveLength(2);
    expect(sizesOf(groups)).toEqual([3, 3]);
    expect(groups[0].every((id) => id.startsWith('m'))).toBe(true);
    expect(groups[1].every((id) => id.startsWith('f'))).toBe(true);
    expect(leftover).toEqual([]);
  });

  it('남자 5명 + 여자 4명 → 크기 3·2·2·2, 전원 사용·시드 순서 유지, leftover 0명', () => {
    const pool = poolOf(
      ['m1', 'f1', 'm2', 'f2', 'm3', 'f3', 'm4', 'f4', 'm5'],
      ['M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M'],
    );
    const { groups, leftover } = autoPairGroups(pool, 'same');
    expect(sizesOf(groups)).toEqual([3, 2, 2, 2]);
    expect(groups).toEqual([
      ['m1', 'm2', 'm3'],
      ['m4', 'm5'],
      ['f1', 'f2'],
      ['f3', 'f4'],
    ]);
    expect(groups.flat().sort()).toEqual(pool.map((p) => p.id).sort());
    expect(leftover).toEqual([]);
  });

  it('남자 1명 + 여자 4명 → 3인 혼합 팀 + 2인 팀, leftover 0명', () => {
    const { groups, leftover } = autoPairGroups(
      poolOf(['m1', 'f1', 'f2', 'f3', 'f4'], ['M', 'F', 'F', 'F', 'F']),
      'same',
    );
    expect(sizesOf(groups)).toEqual([3, 2]);
    const trio = groups.find((g) => g.length === 3)!;
    expect(trio).toContain('m1');
    expect(trio.filter((id) => id.startsWith('f'))).toHaveLength(2);
    expect(groups.flat().sort()).toEqual(['f1', 'f2', 'f3', 'f4', 'm1']);
    expect(leftover).toEqual([]);
  });

  it('예외 케이스들 — 남1+여1은 혼성 2인 팀, 남1+여3처럼 총 4명은 2인 팀 2개', () => {
    const two = autoPairGroups(poolOf(['m1', 'f1'], ['M', 'F']), 'same');
    expect(two.groups).toEqual([['m1', 'f1']]);
    expect(two.leftover).toEqual([]);

    const four = autoPairGroups(poolOf(['m1', 'f1', 'f2', 'f3'], ['M', 'F', 'F', 'F']), 'same');
    expect(sizesOf(four.groups)).toEqual([2, 2]);
    expect(four.groups.flat().sort()).toEqual(['f1', 'f2', 'f3', 'm1']);
    expect(four.leftover).toEqual([]);
  });

  it('총 2~20명 어떤 성별 구성이어도 leftover는 항상 0명', () => {
    for (let n = 2; n <= 20; n += 1) {
      const pool = Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        gender: (Math.random() < 0.5 ? 'M' : 'F') as 'M' | 'F',
      }));
      const { groups, leftover } = autoPairGroups(pool, 'same');
      expect(leftover).toEqual([]);
      expect(groups.flat().sort()).toEqual(pool.map((p) => p.id).sort());
      for (const g of groups) expect(g.length === 2 || g.length === 3).toBe(true);
    }
  });

  it('기존 짝수 동작 회귀 — 성별 내 인접 2인 페어링과 순서를 유지', () => {
    const { groups, leftover } = autoPairGroups(
      poolOf(['m1', 'f1', 'm2', 'f2', 'm3', 'f3', 'm4', 'f4'], [
        'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F',
      ]),
      'same',
    );
    expect(groups).toEqual([
      ['m1', 'm2'],
      ['m3', 'm4'],
      ['f1', 'f2'],
      ['f3', 'f4'],
    ]);
    expect(leftover).toEqual([]);
  });
});

describe('autoPairGroups 무작위 페어링', () => {
  it('무작위 5명 ×100회 — 매번 3인 팀 1개 + 2인 팀 1개, 전원 1회씩, leftover 0명', () => {
    const pool = poolOf(['r1', 'r2', 'r3', 'r4', 'r5']);
    for (let i = 0; i < 100; i += 1) {
      const { groups, leftover } = autoPairGroups(pool, 'any');
      expect(sizesOf(groups).sort()).toEqual([2, 3]);
      expect(leftover).toEqual([]);
      const flat = groups.flat();
      expect(new Set(flat).size).toBe(5);
      expect([...flat].sort()).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    }
  });

  it('무작위 7명 — 3인 팀 1개 + 2인 팀 2개', () => {
    const { groups, leftover } = autoPairGroups(
      poolOf(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']),
      'any',
    );
    expect(sizesOf(groups).sort()).toEqual([2, 2, 3]);
    expect(leftover).toEqual([]);
    expect(groups.flat().sort()).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  });

  it('무작위 짝수 회귀 — 4/6/8명은 모두 2인 팀', () => {
    for (const [n, expectSizes] of [
      [4, [2, 2]],
      [6, [2, 2, 2]],
      [8, [2, 2, 2, 2]],
    ] as const) {
      const pool = poolOf(Array.from({ length: n }, (_, i) => `e${i + 1}`));
      const { groups, leftover } = autoPairGroups(pool, 'any');
      expect(sizesOf(groups)).toEqual([...expectSizes]);
      expect(leftover).toEqual([]);
      expect(groups.flat().sort()).toEqual(pool.map((p) => p.id).sort());
    }
  });
});

/* ============================ 3인 팀 출전 조합 ============================ */

const canon = (p: TeamPairing) => [...p].sort().join('+');

describe('3인 팀 출전 조합 생성/순환', () => {
  it('A+B, B+C, A+C 정확히 3개 — 중복 없고 각 선수가 정확히 2번씩', () => {
    const ps = trioPairings(['A', 'B', 'C']);
    expect(ps).toHaveLength(3);
    expect(ps.map(canon).sort()).toEqual(['A+B', 'A+C', 'B+C']);
    expect(new Set(ps.map(canon)).size).toBe(3);
    const count: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (const id of ps.flat()) count[id] += 1;
    expect(count).toEqual({ A: 2, B: 2, C: 2 });
    expect(pairingsCover(ps, ['A', 'B', 'C'])).toBe(true);
  });

  it('랜덤 순서 ×100회 — 조합 집합은 항상 동일하고 중복이 없으며 순서만 다르다', () => {
    const base = trioPairings(['A', 'B', 'C']);
    const orders = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const shuffled = shufflePairings(base);
      expect(shuffled.map(canon).sort()).toEqual(['A+B', 'A+C', 'B+C']);
      expect(new Set(shuffled.map(canon)).size).toBe(3);
      expect(pairingsCover(shuffled, ['A', 'B', 'C'])).toBe(true);
      orders.add(shuffled.map((p) => p.join('')).join(','));
    }
    expect(orders.size).toBeGreaterThan(1); // 실제로 순서가 섞인다
  });

  it('구성원 변경(A,B,C → A,B,D) 시 기존 조합을 폐기하고 새 구성원으로 재생성', () => {
    const before = withValidPairings({
      id: 't',
      name: '팀',
      members: ['A', 'B', 'C'],
      pairings: trioPairings(['A', 'B', 'C']),
    });
    expect(before.pairings).toEqual([
      ['A', 'B'],
      ['B', 'C'],
      ['A', 'C'],
    ]);
    const after = withValidPairings({ ...before, members: ['A', 'B', 'D'] });
    expect(after.pairings).toEqual([
      ['A', 'B'],
      ['B', 'D'],
      ['A', 'D'],
    ]);
    expect(after.pairings!.flat()).not.toContain('C');
    expect(pairingsCover(after.pairings!, ['A', 'B', 'D'])).toBe(true);
  });

  it('구성원이 그대로면 pairings 순서를 유지한다 (이름 변경 등)', () => {
    const shuffled: TeamPairing[] = [
      ['B', 'C'],
      ['A', 'C'],
      ['A', 'B'],
    ];
    const team = withValidPairings({ id: 't', name: '새이름', members: ['A', 'B', 'C'], pairings: shuffled });
    expect(team.pairings).toEqual(shuffled);
  });
});

describe('localStorage 저장/복구 호환성', () => {
  it('pairings가 없는 기존 2인 팀 데이터를 그대로 복구한다', () => {
    const legacy = { id: 'old-1', name: 'A팀', members: ['a1', 'a2'] };
    const restored = withValidPairings(JSON.parse(JSON.stringify(legacy)) as Team);
    expect(restored.members).toEqual(['a1', 'a2']);
    expect(restored.pairings).toBeUndefined();
    expect(restored.size).toBeUndefined();
  });

  it('3인 팀의 pairings는 저장·복구 후에도 순서가 동일하다 (새로고침 시 재셔플 없음)', () => {
    const shuffled: TeamPairing[] = [
      ['B', 'C'],
      ['A', 'C'],
      ['A', 'B'],
    ];
    const team: Team = {
      id: 'trio-1',
      name: '삼총사',
      members: ['A', 'B', 'C'],
      size: 3,
      pairings: shuffled,
    };
    const restored = withValidPairings(JSON.parse(JSON.stringify(team)) as Team);
    expect(restored.pairings).toEqual(shuffled);
    expect(pairingsCover(restored.pairings!, ['A', 'B', 'C'])).toBe(true);
  });
});

describe('3인 팀의 getTeams · 브래킷 통합', () => {
  const trio: Team = {
    id: 'trio',
    name: '트리오',
    members: ['A', 'B', 'C'],
    size: 3,
    pairings: trioPairings(['A', 'B', 'C']),
  };
  const pair = (id: string): Team => ({ id, name: id, members: [`${id}-1`, `${id}-2`] });
  const ev: TEvent = {
    id: 'dbl-333',
    teams: [trio],
    excludedIds: [],
    matches: null,
    scoreMode: 'time',
    seedMode: 'order',
    currentMatchId: null,
  };

  it('getTeams가 3인 팀을 유효 팀으로 유지한다', () => {
    expect(getTeams([] as Athlete[], ev, 'double').map((t) => t.id)).toEqual(['trio']);
  });

  it('3인 팀은 브래킷에서 복제되지 않고 하나의 팀·하나의 시드로 한 번만 배치된다', () => {
    const teams = [trio, pair('t2'), pair('t3')];
    const round0 = buildMatches(teams, 'order').filter((m) => m.round === 0);
    const placed = round0.flatMap((m) => [m.a, m.b]).filter(Boolean);
    expect(placed.filter((id) => id === 'trio')).toHaveLength(1);
    const slot = round0.find((m) => m.a === 'trio' || m.b === 'trio')!;
    expect(slot.a === 'trio' ? slot.pairingA : slot.pairingB).toBe(0);
  });

  it('첫 경기는 조합 인덱스 0으로 시작하고, 실경기 승리 시 다음 라운드는 인덱스 +1로 순환한다', () => {
    const teams = [trio, pair('t2'), pair('t3'), pair('t4')];
    const map = teamMap(teams);
    const built = buildMatches(teams, 'order');
    const r0 = built.find((m) => m.round === 0 && (m.a === 'trio' || m.b === 'trio'))!;
    expect(r0.a).toBe('trio'); // 4팀 표준 시드 패턴에서 1번 시드는 A측
    expect(r0.pairingA).toBe(0);

    const decided = built.map((m) =>
      m.round === 0 && m.a && m.b ? { ...m, decided: true, winner: 'A' as const } : m,
    );
    const next = propagate(decided, map);
    const final = next.find((m) => m.round === 1)!;
    expect(final.a).toBe('trio');
    expect(final.pairingA).toBe(1); // 실경기 1회 소화 → 다음 조합
  });

  it('부전승(BYE) 라운드는 조합을 소진하지 않는다 (인덱스 유지)', () => {
    const teams = [trio, pair('t2'), pair('t3')];
    const built = buildMatches(teams, 'order'); // 3팀 → 1번 시드 BYE 자동 승리
    const final = built.find((m) => m.round === 1)!;
    expect(final.a).toBe('trio');
    expect(final.pairingA).toBe(0);
  });
});
