import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useConfirm } from '../uic';
import { effectiveCurrentId, matchListByRound } from '../bracket';
import { getTeams, presetOf, roundName, teamMap } from '../presets';
import { Match, ScoreMode, Team, TEvent } from '../types';
import { cls, formatTime, parseTime } from '../format';

/* ---------------------------------- 점수 입력 ---------------------------------- */

function ScoreInput({
  value,
  mode,
  onCommit,
}: {
  value: number | null;
  mode: ScoreMode;
  onCommit: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value == null ? '' : mode === 'time' ? String(value / 1000) : String(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value == null ? '' : mode === 'time' ? String(value / 1000) : String(value));
  }, [value, mode]);

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
  recordOpen,
  onScore,
  onWin,
}: {
  ev: TEvent;
  m: Match;
  side: 'A' | 'B';
  map: Map<string, Team>;
  recordOpen: boolean;
  onScore: (side: 'A' | 'B', v: number | null) => void;
  onWin: (side: 'A' | 'B') => void;
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

  // 3인 팀: 이 경기에 실제 출전하는 2인 조합을 표시한다.
  const pairIdx = side === 'A' ? m.pairingA : m.pairingB;
  const activePair =
    team && team.pairings && team.pairings.length > 0
      ? team.pairings[(pairIdx ?? 0) % team.pairings.length]
      : null;
  const pairNames = activePair
    ? activePair.map((id) => state.athletes.find((a) => a.id === id)?.name ?? '??').join(' + ')
    : null;

  const showInput = both && recordOpen;
  const selectable = both && !m.decided && !!tid;

  return (
    <div
      className={cls(clsList, selectable && 'selectable')}
      onClick={
        selectable
          ? (e) => {
              e.stopPropagation();
              onWin(side);
            }
          : undefined
      }
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onWin(side);
              }
            }
          : undefined
      }
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-label={selectable ? `${team?.name ?? ''} 승리 처리` : undefined}
    >
      <span className="slot-tag">{side}</span>
      {tid ? (
        <span className={cls('slot-name', pairNames && 'wrap')} title={memberNames ?? undefined}>
          {team?.name ?? '—'}
          {memberNames && <small className="slot-members">{memberNames}</small>}
          {pairNames && (
            <small className="slot-pair-now" title="이번 경기 출전 조합">
              ▶ {pairNames}
            </small>
          )}
        </span>
      ) : (
        <span className="slot-name tbd-text">{m.decided ? 'BYE' : '미정'}</span>
      )}
      <span className="slot-score">
        {showInput ? (
          <ScoreInput value={score} mode={ev.scoreMode} onCommit={(v) => onScore(side, v)} />
        ) : score == null ? (
          ''
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
  const { state, dispatch } = useStore();
  const { askConfirm } = useConfirm();
  const [recordOpen, setRecordOpen] = useState(false);
  const both = !!(m.a && m.b);

  // 3인 팀 슬롯의 현재/다음 출전 조합 정보 (2인 팀이면 null)
  const pairInfo = (side: 'A' | 'B') => {
    const tid = side === 'A' ? m.a : m.b;
    const team = tid ? map.get(tid) : undefined;
    const pairings = team?.pairings;
    if (!pairings || pairings.length === 0) return null;
    const idx = ((side === 'A' ? m.pairingA : m.pairingB) ?? 0) % pairings.length;
    const nm = (id: string) => state.athletes.find((a) => a.id === id)?.name ?? '??';
    const fmt = (i: number) => pairings[i].map(nm).join(' + ');
    return { now: fmt(idx), next: fmt((idx + 1) % pairings.length) };
  };
  const piA = pairInfo('A');
  const piB = pairInfo('B');

  const onScore = (side: 'A' | 'B', v: number | null) => {
    // 기록은 승자 판정과 독립적으로 저장한다.
    dispatch({ type: 'match/score', id: ev.id, matchId: m.id, side, value: v });
  };

  const onWin = (side: 'A' | 'B') => {
    if (!both || m.decided) return;
    dispatch({ type: 'match/setResult', id: ev.id, matchId: m.id, winner: side, clearScores: false });
  };

  const cancelResult = () =>
    askConfirm({
      title: '경기 결과 초기화',
      message: `이번 경기의 점수와 결과를 지웁니다. 다음 라운드부터의 진출·결과도 함께 초기화됩니다.`,
      danger: true,
      confirmLabel: '초기화',
      onConfirm: () => {
        dispatch({ type: 'match/setResult', id: ev.id, matchId: m.id, winner: null, clearScores: true });
        setRecordOpen(false);
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
        <Slot ev={ev} m={m} side="A" map={map} recordOpen={recordOpen} onScore={onScore} onWin={onWin} />
        <Slot ev={ev} m={m} side="B" map={map} recordOpen={recordOpen} onScore={onScore} onWin={onWin} />
        {mode === 'edit' && (
          <div className="mfoot" onClick={(e) => e.stopPropagation()}>
            {both && (
              <button className="btn tiny" onClick={() => setRecordOpen((open) => !open)}>
                ⏱ 기록 {recordOpen ? '닫기' : '입력'}
              </button>
            )}
            {!m.decided && both && piA && (
              <button
                className="btn tiny pair-btn"
                title={`A측 출전 조합을 다음으로 교체 (현재: ${piA.now} → 다음: ${piA.next})`}
                onClick={() => dispatch({ type: 'match/pairingNext', id: ev.id, matchId: m.id, side: 'A' })}
              >
                🔄 A 조합
              </button>
            )}
            {!m.decided && both && piB && (
              <button
                className="btn tiny pair-btn"
                title={`B측 출전 조합을 다음으로 교체 (현재: ${piB.now} → 다음: ${piB.next})`}
                onClick={() => dispatch({ type: 'match/pairingNext', id: ev.id, matchId: m.id, side: 'B' })}
              >
                🔄 B 조합
              </button>
            )}
            {!m.decided && both && (piA || piB) && (
              <span className="pair-hint">
                {piA && `A측 다음: ${piA.next}`}
                {piA && piB && ' · '}
                {piB && `B측 다음: ${piB.next}`}
              </span>
            )}
            {!m.decided && both && <span className="win-hint">👆 이긴 쪽 이름 클릭 = 승리</span>}
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
