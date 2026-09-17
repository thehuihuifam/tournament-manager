import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useConfirm } from '../uic';
import { decideFromScores, effectiveCurrentId, matchListByRound } from '../bracket';
import { getTeams, presetOf, roundName, teamMap } from '../presets';
import { Match, ScoreMode, Team, TEvent } from '../types';
import { cls, formatTime, parseTime } from '../format';

/* ---------------------------------- 점수 입력 ---------------------------------- */

function ScoreInput({
  value,
  mode,
  tick,
  onCommit,
}: {
  value: number | null;
  mode: ScoreMode;
  tick: number;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value == null ? '' : mode === 'time' ? String(value / 1000) : String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value == null ? '' : mode === 'time' ? String(value / 1000) : String(value));
  }, [value, mode, tick]);

  const commit = () => {
    const t = draft.trim();
    let v: number | null = null;
    if (t) {
      if (mode === 'time') {
        v = parseTime(t);
      } else {
        const n = Math.round(Number(t));
        v = Number.isFinite(n) && n >= 0 && n <= 99 ? n : null;
      }
    }
    if (t && v == null) return; // 유효하지 않으면 무시 (blur 시 기존값 유지)
    onCommit(v);
  };

  return (
    <input
      ref={ref}
      className="score-input"
      inputMode={mode === 'time' ? 'decimal' : 'numeric'}
      placeholder={mode === 'time' ? '23.456' : '세트'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label="기록"
    />
  );
}

/* ---------------------------------- 매치 슬롯 ---------------------------------- */

function Slot({
  ev,
  m,
  side,
  map,
  tick,
  onScore,
}: {
  ev: TEvent;
  m: Match;
  side: 'A' | 'B';
  map: Map<string, Team>;
  tick: number;
  onScore: (side: 'A' | 'B', v: number | null) => void;
}) {
  const { state } = useStore();
  const preset = presetOf(ev.id);
  const tid = side === 'A' ? m.a : m.b;
  const score = side === 'A' ? m.scoreA : m.scoreB;
  const both = !!(m.a && m.b);

  let clsList = 'slot';
  if (!tid) clsList += m.decided ? ' bye' : ' tbd';
  if (m.decided && m.winner) clsList += m.winner === side ? ' winner' : ' loser';

  const team = tid ? map.get(tid) : null;
  const memberNames =
    team && preset.kind === 'double'
      ? team.members.map((id) => state.athletes.find((a) => a.id === id)?.name ?? '??').join(' · ')
      : null;

  const showInput = both && !m.decided;

  return (
    <div className={clsList}>
      <span className="slot-tag">{side}</span>
      {tid ? (
        <span className="slot-name" title={memberNames ?? undefined}>
          {team?.name ?? '—'}
          {memberNames && <small className="slot-members">{memberNames}</small>}
        </span>
      ) : (
        <span className="slot-name tbd-text">{m.decided ? 'BYE' : '미정'}</span>
      )}
      <span className="slot-score">
        {showInput ? (
          <ScoreInput value={score} mode={ev.scoreMode} tick={tick} onCommit={(v) => onScore(side, v)} />
        ) : score == null ? (
          '—'
        ) : ev.scoreMode === 'time' ? (
          formatTime(score)
        ) : (
          `${score}세트`
        )}
      </span>
      {m.decided && m.winner === side && <span className="slot-flag">🏆</span>}
    </div>
  );
}

/* ---------------------------------- 매치 카드 ---------------------------------- */

function MatchCell({
  ev,
  m,
  mode,
  map,
  span,
  rowStart,
  isFirst,
  isFinal,
  isCur,
}: {
  ev: TEvent;
  m: Match;
  mode: 'edit' | 'view';
  map: Map<string, Team>;
  span: number;
  rowStart: number;
  isFirst: boolean;
  isFinal: boolean;
  isCur: boolean;
}) {
  const { dispatch } = useStore();
  const { askConfirm } = useConfirm();
  const [tick, setTick] = useState(0);
  const both = !!(m.a && m.b);
  const tied =
    both && m.scoreA != null && m.scoreB != null && m.scoreA === m.scoreB;
  const autoWinner = both ? decideFromScores(m, ev.scoreMode) : null;

  const nameOf = (tid: string | null) => (tid ? map.get(tid)?.name ?? '—' : null);

  const onScore = (side: 'A' | 'B', v: number | null) => {
    dispatch({ type: 'match/score', id: ev.id, matchId: m.id, side, value: v });
    if (!m.decided) return;
    // 결정된 매치의 점수 수정: 승자가 바뀌면 다음 라운드부터 초기화(확인 필요)
    const next = { ...m, [side === 'A' ? 'scoreA' : 'scoreB']: v };
    const w = decideFromScores(next, ev.scoreMode);
    if (w === m.winner) return;
    askConfirm({
      title: '점수 수정 · 승자 변경',
      message: `결과가 “${nameOf(m.winner === 'A' ? m.a : m.b)}” → “${
        w ? nameOf(w === 'A' ? m.a : m.b) : '무승부(결과 해제)'
      }”으로 바뀝니다. 다음 라운드부터의 진출·결과가 자동으로 초기화됩니다.`,
      danger: true,
      confirmLabel: '초기화하고 수정',
      onConfirm: () => {
        dispatch({ type: 'match/score', id: ev.id, matchId: m.id, side, value: v });
        dispatch({ type: 'match/setResult', id: ev.id, matchId: m.id, winner: w, clearScores: false });
        setTick((t) => t + 1);
      },
    });
  };

  const cancelResult = () =>
    askConfirm({
      title: '경기 결과 초기화',
      message: `이번 경기의 점수와 결과를 지웁니다. 다음 라운드부터의 진출·결과도 함께 초기화됩니다.`,
      danger: true,
      confirmLabel: '초기화',
      onConfirm: () => {
        dispatch({ type: 'match/setResult', id: ev.id, matchId: m.id, winner: null, clearScores: true });
        setTick((t) => t + 1);
      },
    });

  const clickable =
    mode === 'edit'
      ? () => dispatch({ type: 'match/current', id: ev.id, matchId: m.id })
      : both && !m.decided
        ? () => dispatch({ type: 'match/current', id: ev.id, matchId: m.id })
        : undefined;

  return (
    <div className="cell" style={{ gridRow: `${rowStart} / span ${span}` }}>
      {isFirst && <i className="conn v" />}
      {!isFinal && <i className="conn r" />}
      {isFirst && <i className="conn l" />}
      <div
        className={cls(
          'match',
          m.decided && 'decided',
          isCur && 'current',
          both && !m.decided && 'open',
        )}
        onClick={clickable}
        role={clickable ? 'button' : undefined}
      >
        <Slot ev={ev} m={m} side="A" map={map} tick={tick} onScore={onScore} />
        <Slot ev={ev} m={m} side="B" map={map} tick={tick} onScore={onScore} />
        {mode === 'edit' && (
          <div className="mfoot" onClick={(e) => e.stopPropagation()}>
            {!m.decided && both && (
              <>
                <button
                  className="btn tiny primary"
                  disabled={!autoWinner}
                  onClick={() => dispatch({ type: 'match/decide', id: ev.id, matchId: m.id })}
                  title={tied ? '동률입니다. 아래 버튼으로 수동 지정하세요' : '입력된 기록으로 승자 결정'}
                >
                  🏁 승자 결정
                </button>
                <button className="btn tiny" onClick={() => dispatch({ type: 'match/setResult', id: ev.id, matchId: m.id, winner: 'A', clearScores: false })} title={`${nameOf(m.a)} 수동 승`}>
                  A승
                </button>
                <button className="btn tiny" onClick={() => dispatch({ type: 'match/setResult', id: ev.id, matchId: m.id, winner: 'B', clearScores: false })} title={`${nameOf(m.b)} 수동 승`}>
                  B승
                </button>
                {tied && <span className="tie-hint">동률</span>}
              </>
            )}
            {m.decided && (
              <button className="btn tiny ghost-danger" onClick={cancelResult}>
                ↺ 결과 초기화
              </button>
            )}
            {isCur && !m.decided && <span className="cur-hint">▶ 진행 중</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- 브래킷 보드 ---------------------------------- */

export function BracketBoard({ ev, mode }: { ev: TEvent; mode: 'edit' | 'view' }) {
  const { state } = useStore();
  if (!ev.matches) return null;
  const preset = presetOf(ev.id);
  const teams = getTeams(state.athletes, ev, preset.kind);
  const map = teamMap(teams);
  const byRound = matchListByRound(ev.matches);
  const rows = byRound[0].length; // 1라운드 매치 수 (= size/2)
  const curId = effectiveCurrentId(ev);

  return (
    <div className={cls('bracket', mode === 'view' && 'bracket-view')}>
      {byRound.map((ms, r) => (
        <div className="br-col" key={r} style={{ ['--rows' as never]: rows } as React.CSSProperties}>
          <div className="br-round">
            {roundName(ev.matches!, r)}
            <small>{ms.length}경기</small>
          </div>
          {ms.map((m) => (
            <MatchCell
              key={m.id}
              ev={ev}
              m={m}
              mode={mode}
              map={map}
              span={2 ** r}
              rowStart={2 ** r * m.index + 1}
              isFirst={r > 0}
              isFinal={r === byRound.length - 1}
              isCur={m.id === curId}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
