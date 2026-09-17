export type Gender = 'M' | 'F';

export interface Athlete {
  id: string;
  no: number; // 참가번호 (시드 순서 기준)
  name: string;
  gender: Gender;
}

export type EventKind = 'individual' | 'double';

export interface EventPreset {
  id: string;
  name: string;
  short: string;
  kind: EventKind;
  desc: string;
}

/** 3인 팀이 치르는 한 번의 매치에 실제 출전하는 2인 조합 (선수 id 2개 — A+B와 B+A는 같은 조합) */
export type TeamPairing = [string, string];

export interface Team {
  id: string;
  name: string;
  /** 개인전: 1명, 더블: 2명 또는 3명 (선수 id) */
  members: string[];
  /** 더블 팀 슬롯 수 (기본 2). 3이면 세 번째 슬롯까지 표시·배정 가능 */
  size?: 2 | 3;
  /**
   * 3인 더블 팀의 경기별 2인 출전 조합 — [A+B, B+C, A+C] 세 가지가 정확히 한 번씩.
   * 배열 순서 = 경기 진행 순서. 팀 생성 시 한 번만 결정해 저장하고,
   * 구성원이 바뀌면 폐기 후 재생성한다. 2인 팀은 생략 가능.
   */
  pairings?: TeamPairing[];
}

export type ScoreMode = 'time' | 'sets';
export type SeedMode = 'order' | 'random';

/** 프로젝터 발표 모드 테마 — 기본은 밝은 라이트(체육관 조명/저휘도 빔프로젝터에서 가독성 우선) */
export type ProjectorTheme = 'light' | 'dark';

export interface Match {
  id: string;
  round: number; // 0부터
  index: number; // 라운드 내 순번
  a: string | null; // 팀 id (null = 부전승 슬롯 또는 미진출)
  b: string | null;
  /** time 모드: 밀리초, sets 모드: 세트 수 */
  scoreA: number | null;
  scoreB: number | null;
  winner: 'A' | 'B' | null;
  decided: boolean;
  /** 3인 팀이 들어선 슬롯의 현재 출전 조합 인덱스 (team.pairings 기준). 2인 팀이면 생략 */
  pairingA?: number;
  pairingB?: number;
}

export interface TEvent {
  id: string; // 프리셋 id
  /** 더블 종목용 팀 (개인전은 로스터에서 유산 처리) */
  teams: Team[];
  /** 개인전: 이 종목에 불참할 선수 id */
  excludedIds: string[];
  matches: Match[] | null;
  scoreMode: ScoreMode;
  seedMode: SeedMode;
  currentMatchId: string | null;
}

export type Step = 'participants' | 'brackets' | 'results';

export interface AppState {
  athletes: Athlete[];
  events: TEvent[];
  activeEventId: string;
  step: Step;
  /** 발표 모드 진입 여부 (세션 전용 — 저장하지 않음) */
  projector: boolean;
  /** 발표 모드 테마 (저장됨 · 기존 저장 데이터에 없으면 라이트로 복구) */
  projectorTheme: ProjectorTheme;
}
