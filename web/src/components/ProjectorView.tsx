import { useStore } from '../store';
import { effectiveCurrentId, matchListByRound, podium } from '../bracket';
import { eventStatus, getTeams, presetOf, roundCount, roundName, teamMap } from '../presets';
import { Match, ScoreMode, Team, TEvent } from '../types';
import { cls, formatTime } from '../format';
import { BracketBoard } from './BracketBoard';
import { PodiumCard } from './Podium';

function sideName(t: Team | undefined): string {
  return t?.name ?? '—';
}

function NowPlaying({ ev, cur, map }: { ev: TEvent; cur: Match; map: Map<string, Team> }) {
  const { state } = useStore();
  const preset = presetOf(ev.id);
  const a = cur.a ? map.get(cur.a) : undefined;
  const b = cur.b ? map.get(cur.b) : undefined;
  const rounds = roundCount(ev.matches!);
  const membersOf = (t?: Team) =>
    t && preset.kind === 'double'
      ? t.members.map((id) => state.athletes.find((x) => x.id === id)?.name ?? '??').join(' · ')
      : null;
  const scoreText = (s: number | null, mode: ScoreMode) =>
    s == null ? null : mode === 'time' ? formatTime(s) : `${s} 세트`;

  return (
    <div className="now">
      <div className="now-head">
        <span className="now-round">{roundName(ev.matches!, cur.round)}</span>
        <span className="now-live">● 진행 중</span>
        <span className="now-sub">
          {cur.round + 1} / {rounds} 라운드
        </span>
      </div>
      <div className="now-body">
        <div className={cls('now-side', cur.winner === 'A' && 'winner', cur.winner === 'B' && 'loser')}>
          <div className="now-name">{sideName(a)}</div>
          <div className="now-members">{membersOf(a) ?? '\u00A0'}</div>
          <div className="now-score">{scoreText(cur.scoreA, ev.scoreMode) ?? '—'}</div>
          {cur.winner === 'A' && <div className="now-flag">🏆 승</div>}
        </div>
        <div className="now-vs" aria-hidden>
          VS
        </div>
        <div className={cls('now-side', cur.winner === 'B' && 'winner', cur.winner === 'A' && 'loser')}>
          <div className="now-name">{sideName(b)}</div>
          <div className="now-members">{membersOf(b) ?? '\u00A0'}</div>
          <div className="now-score">{scoreText(cur.scoreB, ev.scoreMode) ?? '—'}</div>
          {cur.winner === 'B' && <div className="now-flag">🏆 승</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * 빔프로젝터 발표 모드 — 고대비 · 대형 글씨 · 전체화면.
 * 편집/관리 UI를 모두 숨기고 대진표 + 현재 경기(Now Playing)만 크게 띄운다.
 */
export function ProjectorView() {
  const { state, dispatch } = useStore();
  const ev = state.events.find((e) => e.id === state.activeEventId) ?? state.events[0];
  const preset = presetOf(ev.id);
  const teams = getTeams(state.athletes, ev, preset.kind);
  const map = teamMap(teams);
  const curId = effectiveCurrentId(ev);
  const cur = ev.matches?.find((m) => m.id === curId) ?? null;
  const res = ev.matches ? podium(ev.matches) : null;
  const byRound = ev.matches ? matchListByRound(ev.matches) : [];

  // 미결정(진행 가능) 매치 순서로 ‹ › 이동
  const navIds = (ev.matches ?? []).filter((m) => !m.decided && m.a && m.b).map((m) => m.id);
  const navIdx = curId ? navIds.indexOf(curId) : -1;
  const stepMatch = (d: number) => {
    if (navIds.length === 0 || navIdx === -1) return;
    const n = (navIdx + d + navIds.length) % navIds.length;
    dispatch({ type: 'match/current', id: ev.id, matchId: navIds[n] });
  };

  const nm = (id: string | null) => (id ? map.get(id)?.name ?? '—' : null);

  return (
    <div className="projector">
      <div className="pj-top">
        <div className="pj-brand">
          🥤 스포츠스태킹 <b>{preset.name}</b>
        </div>
        <div className="pj-chips" role="tablist" aria-label="종목">
          {state.events.map((e) => {
            const st = eventStatus(e);
            return (
              <button
                key={e.id}
                className={cls('pj-chip', e.id === ev.id && 'active', `st-${st}`)}
                onClick={() => dispatch({ type: 'event/active', id: e.id })}
              >
                <i className="dot" aria-hidden />
                {presetOf(e.id).short}
              </button>
            );
          })}
        </div>
        <button className="pj-exit" onClick={() => dispatch({ type: 'ui/projector', on: false })}>
          ✕ 종료 <small>(ESC)</small>
        </button>
      </div>

      {res ? (
        <div className="pj-podium-wrap">
          <h2 className="pj-podium-title">🏆 {preset.name} 최종 결과</h2>
          <div className="podium pj-podium">
            <PodiumCard rank={2} label="준우승" name={nm(res.runnerUp)} big />
            <PodiumCard rank={1} label="우승" name={nm(res.winner)} big />
            <PodiumCard
              rank={3}
              label={res.third.length > 1 ? '공동 3위' : res.third.length === 1 ? '3위' : '—'}
              names={res.third.length > 0 ? res.third.map((id) => map.get(id)?.name ?? '—') : undefined}
              name={res.third.length === 1 ? nm(res.third[0]) : undefined}
              big
            />
          </div>
          <p className="pj-hint">위 종목 탭을 눌러 다른 종목 결과 보기 · ESC 또는 ✕ 로 종료</p>
        </div>
      ) : ev.matches ? (
        <div className="pj-main">
          <div className="pj-now-wrap">
            {cur ? (
              <NowPlaying ev={ev} cur={cur} map={map} />
            ) : (
              <div className="pj-waiting">
                <span className="pj-waiting-icon" aria-hidden>
                  ⏳
                </span>
                <strong>결과 대기 중</strong>
                <small>현재 라운드가 모두 끝나면 다음 라운드가 자동으로 나타납니다</small>
              </div>
            )}
            <div className="pj-nav">
              <button onClick={() => stepMatch(-1)} disabled={navIds.length === 0}>
                ‹ 이전 경기
              </button>
              <span className="pj-nav-idx">{navIds.length > 0 ? `${navIdx + 1} / ${navIds.length}` : '—'}</span>
              <button onClick={() => stepMatch(1)} disabled={navIds.length === 0}>
                다음 경기 ›
              </button>
            </div>
          </div>
          <div className="pj-bracket-wrap">
            <div className="pj-bracket-title">
              대진표
              {byRound.length > 0 && (
                <small>
                  {' '}
                  · {roundName(ev.matches!, 0)} {byRound[0].length}경기 → 결승
                </small>
              )}
            </div>
            <div className="pj-bracket-scroll">
              <BracketBoard ev={ev} mode="view" />
            </div>
          </div>
        </div>
      ) : (
        <div className="pj-waiting full">
          <span className="pj-waiting-icon" aria-hidden>
            🏟️
          </span>
          <strong>대진표가 아직 없습니다</strong>
          <small>종료 후 ② 종목별 대진에서 이 종목의 대진표를 생성하면 이곳에 표시됩니다</small>
        </div>
      )}
    </div>
  );
}
