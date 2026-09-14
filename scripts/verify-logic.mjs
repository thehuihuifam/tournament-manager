/**
 * 복원된 순수 로직의 동작 동등성 검증 (Node 내장 assert만 사용)
 * 실행: npm run verify:logic
 */
import assert from 'node:assert/strict';
import {
  bracketSize,
  buildRounds,
  countProgress,
  downstreamMatchIds,
  generateId,
  generateSlots,
  interleaveGenders,
  parseGender,
  roundName,
  seedOrder,
  shuffle,
} from '../src/lib/tournament.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

const mkPlayers = (n, genders = null) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    no: i + 1,
    name: `선수${i + 1}`,
    gender: genders ? genders[i] : i % 2 === 0 ? 'M' : 'F',
  }));

// 1. 브래킷 크기
check('bracketSize', () => {
  assert.equal(bracketSize(2), 2);
  assert.equal(bracketSize(3), 4);
  assert.equal(bracketSize(5), 8);
  assert.equal(bracketSize(22), 32);
  assert.equal(bracketSize(33), 64);
});

// 2. 표준 스네이크 시드 순서
check('seedOrder', () => {
  assert.deepEqual(seedOrder(2), [1, 2]);
  assert.deepEqual(seedOrder(4), [1, 4, 2, 3]);
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

// 3. 라운드명
check('roundName', () => {
  assert.equal(roundName(5, 4), '결승');
  assert.equal(roundName(5, 3), '준결승 (4강)');
  assert.equal(roundName(5, 0), '32강');
  assert.equal(roundName(1, 0), '결승');
});

// 4. 부전승 상위 시드 귀속 (원본 시뮬레이션 대조값과 일치해야 함)
check('bye-allocation-top-seeds', () => {
  const expected = {
    3: [0],
    6: [0, 2],
    7: [0],
    13: [0, 4, 6],
    22: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
    31: [0],
  };
  for (const [nStr, want] of Object.entries(expected)) {
    const n = Number(nStr);
    const slots = generateSlots(mkPlayers(n), 'order', 'top');
    const got = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      if ((a && !b) || (!a && b)) got.push(i / 2);
    }
    assert.deepEqual(got, want, `n=${n}`);
  }
});

// 5. 부전승 자동 진출 (3명: 1번 시드 자동 통과)
check('bye-auto-advance', () => {
  const slots = generateSlots(mkPlayers(3), 'order', 'top');
  const rounds = buildRounds(slots, {});
  assert.equal(rounds[0][0].winner.no, 1);
  assert.equal(rounds[0][0].auto, true);
  assert.equal(rounds[0][1].winner, null);
  assert.equal(rounds[0][1].auto, false);
});

// 6. 승자 선택·하위 전파·무효화 ID
check('downstreamMatchIds', () => {
  assert.deepEqual(downstreamMatchIds('r0m3', 4), ['r1m1', 'r2m0', 'r3m0']);
  assert.deepEqual(downstreamMatchIds('r2m0', 3), []);
});

// 7. 성별 인식 행렬
check('parseGender', () => {
  for (const s of ['남', '남자', '남성', 'M', 'm', 'MALE', 'male', ' 남 ']) {
    assert.equal(parseGender(s), 'M', s);
  }
  for (const s of ['여', '여자', '여성', 'F', 'f', 'FEMALE', 'female']) {
    assert.equal(parseGender(s), 'F', s);
  }
  for (const s of ['?', '', '남여', 'X']) {
    assert.equal(parseGender(s), null, JSON.stringify(s));
  }
});

// 8. 진행률 집계 (4명 신선 브래킷: total 3, done 0 → 1회전 종료 후 done 2)
check('countProgress', () => {
  const slots = generateSlots(mkPlayers(4), 'order', 'top');
  assert.deepEqual(countProgress(buildRounds(slots, {})), { total: 3, done: 0 });
  const results = { r0m0: 'p1', r0m1: 'p3' };
  const rounds = buildRounds(slots, results);
  assert.deepEqual(countProgress(rounds), { total: 3, done: 2 });
  assert.equal(rounds[1][0].p1.no, 1);
  assert.equal(rounds[1][0].p2.no, 3);
});

// 9. 성별 교차 배치
check('interleaveGenders', () => {
  const players = mkPlayers(4, ['M', 'M', 'M', 'F']);
  assert.deepEqual(
    interleaveGenders(players).map((p) => p.gender),
    ['M', 'F', 'M', 'M'],
  );
});

// 10. 셔플 원소 보존
check('shuffle', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual([...shuffle(src)].sort((a, b) => a - b), src);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6, 7, 8]);
});

// 11. ID 유일성
check('generateId', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => generateId()));
  assert.equal(ids.size, 2000);
});

console.log(`\nALL ${passed} LOGIC TESTS PASS`);
