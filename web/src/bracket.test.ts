import { describe, expect, it } from 'vitest';
import { buildMatches, seedPattern } from './bracket';
import { Team } from './types';

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
