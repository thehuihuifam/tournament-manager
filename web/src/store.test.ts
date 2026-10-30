import { describe, expect, it } from 'vitest';
import { buildMatches, propagate } from './bracket';
import { teamAutoName } from './format';
import { defaultState, reconcileEvents, reducer, restoreFromJSON, sanitizeAthletes } from './store';
import { Athlete, AppState, Match, Team, TEvent } from './types';

/* ---------------------------- 테스트 도우미 ---------------------------- */

const athlete = (n: number, name = `선수${n}`, gender: 'M' | 'F' = 'M'): Athlete => ({
  id: `a${n}`,
  no: n,
  name,
  gender,
});

const eventOf = (state: AppState, id: string): TEvent => state.events.find((e) => e.id === id)!;

const pairTeams = (count: number): Team[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    name: `${i + 1}팀`,
    members: [`p${i * 2 + 1}`, `p${i * 2 + 2}`],
  }));

/** 더블 종목(dbl-333)에 2인 팀 N개를 넣고 대진표까지 만든 상태 */
function doubleStateWithBracket(teamCount: number): AppState {
  const base = defaultState();
  const teams = pairTeams(teamCount);
  const roster: Athlete[] = teams.flatMap((t, i) =>
    t.members.map((id, j) => ({ id, no: i * 2 + j + 1, name: `선수-${id}`, gender: 'M' as const })),
  );
  return {
    ...base,
    athletes: roster,
    events: base.events.map((ev) =>
      ev.id === 'dbl-333' ? { ...ev, teams, matches: buildMatches(teams, 'order') } : ev,
    ),
  };
}

const matchById = (ev: TEvent, id: string): Match => ev.matches!.find((m) => m.id === id)!;

/* ------------------- ① 상위 라운드 결과 변경 시 하위 라운드 롤백 ------------------- */

describe('propagate — 출전 팀이 바뀐 경기의 결과는 반드시 초기화된다', () => {
  const teams = pairTeams(4);

  /** 4팀 브래킷: 준결승 두 경기를 A승으로 확정하고 결승까지 A승으로 확정한 상태 */
  function decidedThroughFinal() {
    let matches = buildMatches(teams, 'order');
    matches = matches.map((m) =>
      m.round === 0 ? { ...m, decided: true, winner: 'A' as const, scoreA: 10000, scoreB: 12000 } : m,
    );
    matches = propagate(matches);
    matches = matches.map((m) =>
      m.round === 1 ? { ...m, decided: true, winner: 'A' as const, scoreA: 8000, scoreB: 9000 } : m,
    );
    return propagate(matches);
  }

  it('준결승 승자가 바뀌면 이미 치른 결승의 승자·점수가 초기화된다', () => {
    const before = decidedThroughFinal();
    const finalBefore = before.find((m) => m.round === 1)!;
    expect(finalBefore.decided).toBe(true);
    expect(finalBefore.winner).toBe('A');

    // 1번 준결승(t1 vs t4)의 승자를 B(t4)로 정정한다.
    const changed = before.map((m) =>
      m.id === 'r0-m0' ? { ...m, winner: 'B' as const, decided: true } : m,
    );
    const after = propagate(changed);
    const finalAfter = after.find((m) => m.round === 1)!;

    expect(finalAfter.a).toBe('t4'); // 새로 올라온 팀
    expect(finalAfter.decided).toBe(false);
    expect(finalAfter.winner).toBeNull();
    expect(finalAfter.scoreA).toBeNull();
    expect(finalAfter.scoreB).toBeNull();
  });

  it('준결승 결과가 그대로면 결승 결과도 그대로 유지된다', () => {
    const before = decidedThroughFinal();
    const finalBefore = before.find((m) => m.round === 1)!;
    // 점수만 고쳐 다시 전파해도(승자 그대로) 결승 결과는 살아 있어야 한다.
    const rescored = before.map((m) =>
      m.id === 'r0-m0' ? { ...m, scoreA: 9000, scoreB: 11000 } : m,
    );
    const after = propagate(rescored);
    const finalAfter = after.find((m) => m.round === 1)!;

    expect([finalAfter.a, finalAfter.b]).toEqual([finalBefore.a, finalBefore.b]);
    expect(finalAfter.decided).toBe(true);
    expect(finalAfter.winner).toBe('A');
    expect(finalAfter.scoreA).toBe(8000);
  });

  it('matches 배열 순서가 뒤섞여 있어도(불러온 백업) 라운드 순으로 연쇄 롤백된다', () => {
    const before = decidedThroughFinal();
    const shuffled = [...before].reverse();
    const changed = shuffled.map((m) =>
      m.id === 'r0-m0' ? { ...m, winner: 'B' as const, decided: true } : m,
    );
    const after = propagate(changed);
    expect(after.find((m) => m.round === 1)!.decided).toBe(false);
  });

  it('한쪽 준결승이 미결정으로 롤백되면 결승도 비워진다 (기존 동작 유지)', () => {
    const before = decidedThroughFinal();
    const rollback = before.map((m) =>
      m.id === 'r0-m1' ? { ...m, decided: false, winner: null, scoreA: null, scoreB: null } : m,
    );
    const final = propagate(rollback).find((m) => m.round === 1)!;
    expect(final.a).not.toBeNull();
    expect(final.b).toBeNull();
    expect(final.decided).toBe(false);
    expect(final.winner).toBeNull();
  });
});

/* ---------------------------- ② 명단 가져오기(번호) ---------------------------- */

describe('athlete/import — 참가번호(시드) 보존', () => {
  it('기존에 추가(append)는 기존 참가자의 번호를 그대로 두고 이어서 매긴다', () => {
    let state = defaultState();
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'replace',
      list: [athlete(1, '가'), athlete(2, '나'), athlete(3, '다')],
    });
    expect(state.athletes.map((a) => [a.no, a.name])).toEqual([
      [1, '가'],
      [2, '나'],
      [3, '다'],
    ]);

    state = reducer(state, {
      type: 'athlete/import',
      mode: 'append',
      list: [athlete(4, '라')],
    });
    // 예전에는 기존 선수가 4·5·6번으로 밀려 시드 순서가 뒤바뀌었다.
    expect(state.athletes.map((a) => [a.no, a.name])).toEqual([
      [1, '가'],
      [2, '나'],
      [3, '다'],
      [4, '라'],
    ]);
  });

  it('덮어쓰기(replace)는 명단을 1..n 으로 다시 매긴다', () => {
    let state = defaultState();
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'replace',
      list: [{ ...athlete(9, '가'), no: 9 }, { ...athlete(5, '나'), no: 5 }],
    });
    expect(state.athletes.map((a) => a.no)).toEqual([1, 2]);
  });
});

/* --------------------- ③ 명단 교체 시 팀/대진 정합성 복구 --------------------- */

describe('명단 교체 시 유령 팀·깨진 대진표 정리 (reconcile)', () => {
  it('명단에서 사라진 선수는 팀에서 빠지고, 그 종목 대진표는 초기화된다', () => {
    let state = doubleStateWithBracket(4);
    expect(eventOf(state, 'dbl-333').matches).not.toBeNull();

    // a1(p1)이 빠진 명단으로 교체
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'replace',
      list: state.athletes.filter((a) => a.id !== 'p1').map((a, i) => ({ ...a, no: i + 1 })),
    });

    const ev = eventOf(state, 'dbl-333');
    expect(ev.teams.some((t) => t.members.includes('p1'))).toBe(false);
    expect(ev.teams[0].members).toEqual(['p2']);
    expect(ev.matches).toBeNull();
    expect(ev.currentMatchId).toBeNull();
  });

  it('명단에 선수를 추가(append)하는 것만으로는 기존 대진표를 지우지 않는다', () => {
    let state = doubleStateWithBracket(4);
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'append',
      list: [{ id: 'new-1', no: 99, name: '신규', gender: 'F' }],
    });
    expect(eventOf(state, 'dbl-333').matches).not.toBeNull();
    expect(state.athletes).toHaveLength(9);
  });

  it('개인전: 명단에서 빠진 선수를 가리키는 대진표만 초기화한다', () => {
    let state = defaultState();
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'replace',
      list: [athlete(1, '가'), athlete(2, '나')],
    });
    state = reducer(state, { type: 'event/generate', id: 'ind-333' });
    expect(eventOf(state, 'ind-333').matches).not.toBeNull();

    state = reducer(state, {
      type: 'athlete/import',
      mode: 'append',
      list: [athlete(3, '다')],
    });
    // 개인전 대진은 기존 선수 id를 그대로 참조하므로 유지된다.
    expect(eventOf(state, 'ind-333').matches).not.toBeNull();

    state = reducer(state, {
      type: 'athlete/import',
      mode: 'replace',
      list: [athlete(7, '새1'), athlete(8, '새2')],
    });
    expect(eventOf(state, 'ind-333').matches).toBeNull();
  });

  it('편집 중인 팀(빈 슬롯 포함)은 명단에 선수를 추가해도 그대로 유지된다', () => {
    let state = defaultState();
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'replace',
      list: [athlete(1, '가'), athlete(2, '나')],
    });
    state = reducer(state, {
      type: 'event/teams',
      id: 'dbl-333',
      teams: [{ id: 'draft', name: '작성중', members: ['a1', ''] }],
    });
    state = reducer(state, {
      type: 'athlete/import',
      mode: 'append',
      list: [athlete(3, '다')],
    });
    const teams = eventOf(state, 'dbl-333').teams;
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ id: 'draft', name: '작성중', members: ['a1'] });
  });

  it('reconcileEvents: 불참 목록에 남은 삭제 선수 id도 정리한다', () => {
    const base = defaultState();
    const events = base.events.map((ev) =>
      ev.id === 'ind-363' ? { ...ev, excludedIds: ['a1', 'ghost'] } : ev,
    );
    const next = reconcileEvents([athlete(1, '가')], events);
    expect(eventOf({ ...base, events: next }, 'ind-363').excludedIds).toEqual(['a1']);
  });
});

/* ---------------------------- ④ 기록 입력 → 자동 판정 ---------------------------- */

describe('match/score — 양쪽 기록이 모두 들어오면 자동으로 승자를 판정한다', () => {
  it('기록(시간) 모드: 짧은 기록이 이기고 다음 라운드로 진출한다', () => {
    let state = doubleStateWithBracket(4);
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'A', value: 12345 });
    // 아직 한쪽만 입력 → 미결정
    expect(matchById(eventOf(state, 'dbl-333'), 'r0-m0').decided).toBe(false);

    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'B', value: 18765 });
    const ev = eventOf(state, 'dbl-333');
    const m = matchById(ev, 'r0-m0');
    expect(m.decided).toBe(true);
    expect(m.winner).toBe('A');
    expect(ev.matches!.find((x) => x.round === 1)!.a).toBe('t1');
  });

  it('동률이면 자동 판정하지 않는다 (수동 승자 지정 가능)', () => {
    let state = doubleStateWithBracket(2);
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'A', value: 15000 });
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'B', value: 15000 });
    const m = matchById(eventOf(state, 'dbl-333'), 'r0-m0');
    expect(m.decided).toBe(false);
    expect(m.winner).toBeNull();
  });

  it('세트 모드: 많은 세트를 이긴 쪽이 승리한다', () => {
    let state = doubleStateWithBracket(2);
    state = reducer(state, { type: 'event/scoreMode', id: 'dbl-333', mode: 'sets' });
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'A', value: 2 });
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'B', value: 3 });
    expect(matchById(eventOf(state, 'dbl-333'), 'r0-m0').winner).toBe('B');
  });

  it('이미 결정된 경기는 기록을 고쳐도 승자를 자동으로 뒤집지 않는다', () => {
    let state = doubleStateWithBracket(2);
    state = reducer(state, { type: 'match/setResult', id: 'dbl-333', matchId: 'r0-m0', winner: 'B' });
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'A', value: 1000 });
    state = reducer(state, { type: 'match/score', id: 'dbl-333', matchId: 'r0-m0', side: 'B', value: 9000 });
    expect(matchById(eventOf(state, 'dbl-333'), 'r0-m0').winner).toBe('B');
  });
});

/* ------------------------------ ⑤ 기타 정합성 ------------------------------ */

describe('teamAutoName — 26팀을 넘어도 이름이 겹치지 않는다', () => {
  it('A…Z 다음은 AA, AB 로 이어진다', () => {
    expect(teamAutoName(0)).toBe('A팀');
    expect(teamAutoName(25)).toBe('Z팀');
    expect(teamAutoName(26)).toBe('AA팀');
    expect(teamAutoName(27)).toBe('AB팀');
    expect(teamAutoName(51)).toBe('AZ팀');
    expect(teamAutoName(52)).toBe('BA팀');
  });

  it('0~200번 팀 이름은 모두 서로 다르다', () => {
    const names = Array.from({ length: 201 }, (_, i) => teamAutoName(i));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('저장/백업 데이터 검증', () => {
  it('sanitizeAthletes: 이름 없는 항목은 버리고 id 중복은 새 id로 바꾼다', () => {
    const list = sanitizeAthletes([
      { id: 'x', name: ' 가 ', gender: 'F' },
      { id: 'x', name: '나', gender: 'M' },
      { id: 'z', name: '', gender: 'M' },
      null,
      { name: 123 },
    ])!;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ no: 1, name: '가', gender: 'F' });
    expect(list[1].id).not.toBe('x');
    expect(list.map((a) => a.no)).toEqual([1, 2]);
  });

  it('sanitizeAthletes: 저장된 참가번호(시드) 순서를 존중한다', () => {
    const list = sanitizeAthletes([
      { id: 'c', no: 3, name: '다', gender: 'M' },
      { id: 'a', no: 1, name: '가', gender: 'F' },
      { id: 'b', no: 2, name: '나', gender: 'M' },
    ])!;
    expect(list.map((a) => [a.no, a.name])).toEqual([
      [1, '가'],
      [2, '나'],
      [3, '다'],
    ]);
  });

  it('restoreFromJSON: 손상된 JSON/형식은 null, 정상 백업은 복구된다', () => {
    expect(restoreFromJSON('{oops')).toBeNull();
    expect(restoreFromJSON(JSON.stringify({ athletes: 'nope' }))).toBeNull();

    const base = defaultState();
    const restored = restoreFromJSON(
      JSON.stringify({
        ...base,
        projector: true,
        athletes: [athlete(1, '가', 'F'), athlete(2, '나')],
        events: base.events.map((ev) =>
          ev.id === 'dbl-333'
            ? {
                ...ev,
                scoreMode: 'weird',
                seedMode: 'nope',
                teams: [{ id: 'ghost', name: '유령팀', members: ['사라진선수1', '사라진선수2'] }],
              }
            : ev,
        ),
      }),
    )!;
    expect(restored.projector).toBe(false);
    expect(restored.athletes).toHaveLength(2);
    const ev = eventOf(restored, 'dbl-333');
    expect(ev.scoreMode).toBe('time');
    expect(ev.seedMode).toBe('order');
    // 명단에 없는 선수로만 구성된 팀은 복구 단계에서 제거된다.
    expect(ev.teams).toEqual([]);
  });
});
