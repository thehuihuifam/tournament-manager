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

export interface Team {
  id: string;
  name: string;
  /** 개인전: 1명, 더블: 2명 (선수 id) */
  members: string[];
}

export type ScoreMode = 'time' | 'sets';
export type SeedMode = 'order' | 'random';

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
  projector: boolean;
}
