/**
 * 순수 토너먼트 로직 (DOM / React 의존성 없음)
 *
 * 원본 빌드 산출물(index.html 내 번들)의 동작을 그대로 복원한 모듈.
 * scripts/verify-logic.mjs 로 동작 동등성을 검증한다.
 */

/** 고유 ID 생성 (충돌 확률 무시 가능 수준 — 대회 규모 기준) */
export function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** 참가자 수에 맞는 브래킷 슬롯 수 (2의 거듭제곱 올림, 최소 2) */
export function bracketSize(playerCount) {
  let size = 1;
  while (size < playerCount) size *= 2;
  return Math.max(2, size);
}

/** 라운드 표시명: 결승 / 준결승 (4강) / N강 */
export function roundName(totalRounds, roundIndex) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return '결승';
  if (remaining === 2) return '준결승 (4강)';
  return `${Math.pow(2, remaining)}강`;
}

/**
 * 표준 스네이크 시드 순서
 * 예: 8슬롯 → [1,8,4,5,2,7,3,6]
 */
export function seedOrder(slotCount) {
  let order = [1, 2];
  while (order.length < slotCount) {
    const n = order.length;
    const next = [];
    for (const seed of order) next.push(seed, n * 2 + 1 - seed);
    order = next;
  }
  return order;
}

/** Fisher–Yates 셔플 (원본 배열 변경 없음) */
export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 성별 교차 배치 (다수 성별 우선 지그재그)
 * 예: 남3+여1 → [남,여,남,남]
 */
export function interleaveGenders(players) {
  const males = players.filter((p) => p.gender === 'M');
  const females = players.filter((p) => p.gender === 'F');
  const major = males.length >= females.length ? males : females;
  const minor = major === males ? females : males;
  const out = [];
  let i = 0;
  let k = 0;
  for (let n = 0; n < players.length; n++) {
    if (n % 2 === 0) out.push(i < major.length ? major[i++] : minor[k++]);
    else out.push(k < minor.length ? minor[k++] : major[i++]);
  }
  return out;
}

/**
 * 슬롯 배정: 시드 정렬 → (랜덤 부전승 재배치) → 스네이크 시드 순서로 슬롯 매핑
 * @returns (player|null)[] — 길이 = bracketSize, null = 빈 슬롯(부전승 발생)
 */
export function generateSlots(players, seedMode, byeMode) {
  const size = bracketSize(players.length);
  let ordered;
  if (seedMode === 'random') ordered = shuffle(players);
  else if (seedMode === 'gender') ordered = interleaveGenders(players);
  else ordered = [...players].sort((a, b) => a.no - b.no);

  const byeCount = size - ordered.length;
  if (byeMode === 'random' && byeCount > 0) {
    const picked = shuffle(ordered.map((_, i) => i))
      .slice(0, byeCount)
      .sort((a, b) => a - b);
    const byePlayers = picked.map((i) => ordered[i]);
    const rest = ordered.filter((_, i) => !picked.includes(i));
    ordered = [...byePlayers, ...rest];
  }
  return seedOrder(size).map((seed) => ordered[seed - 1] ?? null);
}

/**
 * 라운드 전체 구성 (부전승 자동 진출 포함)
 * @param slots (player|null)[] — generateSlots 결과
 * @param results { [matchId]: winnerId }
 */
export function buildRounds(slots, results) {
  const slotCount = slots.length;
  const totalRounds = Math.log2(slotCount);
  const rounds = [];
  let prevWinners = [];
  for (let round = 0; round < totalRounds; round++) {
    const matchCount = slotCount / Math.pow(2, round + 1);
    const matches = [];
    for (let index = 0; index < matchCount; index++) {
      let p1;
      let p2;
      if (round === 0) {
        p1 = slots[index * 2];
        p2 = slots[index * 2 + 1];
      } else {
        p1 = prevWinners[index * 2];
        p2 = prevWinners[index * 2 + 1];
      }
      const id = `r${round}m${index}`;
      const p1Pending = p1 === undefined;
      const p2Pending = p2 === undefined;
      const P1 = p1 ?? null;
      const P2 = p2 ?? null;
      let winner = null;
      let auto = false;
      if (!p1Pending && !p2Pending) {
        if (P1 && !P2) {
          winner = P1;
          auto = true;
        } else if (!P1 && P2) {
          winner = P2;
          auto = true;
        } else if (P1 && P2) {
          const picked = results[id];
          winner = picked === P1.id ? P1 : picked === P2.id ? P2 : null;
        }
      }
      const loser = winner && P1 && P2 ? (winner.id === P1.id ? P2 : P1) : null;
      matches.push({
        id,
        round,
        index,
        p1: P1,
        p2: P2,
        p1Pending,
        p2Pending,
        winner,
        loser,
        auto,
      });
    }
    rounds.push(matches);
    prevWinners = matches.map((mm) => {
      if (mm.winner) return mm.winner;
      if (!mm.p1Pending && !mm.p2Pending && !mm.p1 && !mm.p2) return null;
      return undefined;
    });
  }
  return rounds;
}

/** 진행률 집계 (부전승 자동 통과는 total/done 모두 제외) */
export function countProgress(rounds) {
  const real = rounds.flat().filter((mm) => !mm.auto);
  const total = real.filter(
    (mm) => !(mm.p1 === null && mm.p2 === null && !mm.p1Pending && !mm.p2Pending),
  ).length;
  const done = real.filter((mm) => mm.winner).length;
  return { total, done };
}

/**
 * 승자 변경 시 무효화해야 할 하위 매치 ID 목록
 * 예: ('r0m3', 4) → ['r1m1','r2m0','r3m0']
 */
export function downstreamMatchIds(matchId, totalRounds) {
  const [roundStr, indexStr] = matchId.slice(1).split('m');
  let round = parseInt(roundStr, 10);
  let index = parseInt(indexStr, 10);
  const ids = [];
  while (round + 1 < totalRounds) {
    round += 1;
    index = Math.floor(index / 2);
    ids.push(`r${round}m${index}`);
  }
  return ids;
}

/** 성별 문자열 인식 → 'M' | 'F' | null */
export function parseGender(raw) {
  const v = raw.trim().toUpperCase();
  if (['남', '남자', 'M', 'MALE', '남성'].includes(v)) return 'M';
  if (['여', '여자', 'F', 'FEMALE', '여성'].includes(v)) return 'F';
  return null;
}
