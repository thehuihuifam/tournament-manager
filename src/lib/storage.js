/**
 * localStorage 영속화 (키·형식은 원본과 동일 — 기존 저장 데이터와 호환)
 */

export const STORAGE_KEY = 'stacking-tournament-v1';

export const INITIAL_STATE = {
  step: 1,
  players: [],
  seedMode: 'order',
  byeMode: 'top',
  slotIds: null,
  results: {},
};

/** 저장된 상태 불러오기 (없거나 깨졌으면 초기 상태) */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    return { ...INITIAL_STATE, ...parsed };
  } catch {
    return INITIAL_STATE;
  }
}

/** 전체 상태 저장 (용량 초과 등은 조용히 무시) */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 저장 실패 시 무시 */
  }
}

/** 저장 데이터 삭제 */
export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
