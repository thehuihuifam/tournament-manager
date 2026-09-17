import { useStore } from '../store';
import { useConfirm } from '../uic';
import { nextPow2 } from '../bracket';
import { eventStatus, getTeams, presetOf } from '../presets';
import { TEvent } from '../types';
import { cls } from '../format';
import { TeamBuilder } from './TeamBuilder';
import { BracketBoard } from './BracketBoard';

function IndividualParticipation({ ev }: { ev: TEvent }) {
  const { state, dispatch } = useStore();
  const teams = getTeams(state.athletes, ev, 'individual');
  return (
    <div className="builder">
      <div className="builder-teams-head">
        <h3>
          참가 선수 <small>{teams.length}명</small>
        </h3>
        <span className="hint inline">체크박스 = 이 종목 참가 여부 · 참가번호 순 = 시드 순</span>
      </div>
      {state.athletes.length === 0 ? (
        <p className="hint">먼저 ① 참가자 등록에서 명단을 만들어 주세요.</p>
      ) : (
        <ul className="ind-list">
          {state.athletes.map((a) => {
            const inEv = !ev.excludedIds.includes(a.id);
            return (
              <li key={a.id} className={cls('ind-row', !inEv && 'off')}>
                <label className="ind-check">
                  <input
                    type="checkbox"
                    checked={inEv}
                    onChange={() =>
                      dispatch({ type: 'event/exclude', id: ev.id, athleteId: a.id, excluded: !inEv })
                    }
                  />
                  <span />
                </label>
                <span className="ind-no">{a.no}</span>
                <span className="ind-name">
                  {a.name} <span className={a.gender === 'M' ? 'dot-m' : 'dot-f'} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BracketSetup({ ev, teamCount }: { ev: TEvent; teamCount: number }) {
  const { dispatch } = useStore();
  const { askConfirm } = useConfirm();
  const size = nextPow2(teamCount);
  const byes = size - teamCount;

  const generate = () => {
    const isRegenerate = ev.matches !== null;
    const msg =
      !isRegenerate
        ? `팀 ${teamCount}개로 대진표를 만들까요?${byes > 0 ? ` 부전승(BYE) ${byes}개가 자동 배치됩니다.` : ''}`
        : `다시 생성하면 기존 진행·결과가 사라집니다. 계속할까요?`;
    askConfirm({
      title: isRegenerate ? '대진표 다시 만들기' : '대진표 만들기',
      message: msg,
      confirmLabel: isRegenerate ? '대진표 다시 만들기' : '대진표 만들기',
      onConfirm: () => dispatch({ type: 'event/generate', id: ev.id }),
    });
  };

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-icon">🏟️</div>
        <h3>대진표 준비</h3>
        <p>
          <b>{teamCount}</b>개 팀 참가 · 브래킷 규모 <b>{size}칸</b>
          {byes > 0 && (
            <>
              {' '}
              · <b className="bye">부전승 {byes}개</b>{' '}
              {ev.seedMode === 'order'
                ? '(상위 시드 자동 통과 — 공정한 표준 배치)'
                : '(무작위 배치)'}
            </>
          )}
        </p>
        <div className="setup-seg">
          <div className="seg">
            <button
              className={cls('seg-btn', ev.seedMode === 'order' && 'active')}
              onClick={() => dispatch({ type: 'event/seedMode', id: ev.id, mode: 'order' })}
              title="참가번호(팀 순서)를 표준 시드 방식으로 배치. 부전승은 상위 시드에 공정하게 배정"
            >
              🔀 시드 순 배치
            </button>
            <button
              className={cls('seg-btn', ev.seedMode === 'random' && 'active')}
              onClick={() => dispatch({ type: 'event/seedMode', id: ev.id, mode: 'random' })}
              title="팀 순서를 무작위로 섞어 배치"
            >
              🎲 무작위 배치
            </button>
          </div>
        </div>
        <button className="btn primary big" onClick={generate}>
          {ev.matches === null ? '🚩 대진표 만들기' : '↻ 대진표 다시 만들기'}
        </button>
      </div>
    </div>
  );
}

export function EventBoard() {
  const { state, dispatch } = useStore();
  const { askConfirm } = useConfirm();
  const ev = state.events.find((e) => e.id === state.activeEventId) ?? state.events[0];
  const preset = presetOf(ev.id);
  const teams = getTeams(state.athletes, ev, preset.kind);

  return (
    <div className="event-board">
      <div className="event-chips" role="tablist" aria-label="종목 선택">
        {state.events.map((e) => {
          const st = eventStatus(e);
          const p = presetOf(e.id);
          return (
            <button
              key={e.id}
              role="tab"
              aria-selected={e.id === ev.id}
              className={cls('event-chip', e.id === ev.id && 'active', `st-${st}`)}
              onClick={() => dispatch({ type: 'event/active', id: e.id })}
            >
              <i className="dot" aria-hidden />
              {p.short}
            </button>
          );
        })}
      </div>

      <section className="panel event-panel">
        <div className="event-head">
          <div className="event-title">
            <h2>{preset.name}</h2>
            <span className={cls('badge', preset.kind === 'double' ? 'badge-d' : 'badge-i')}>
              {preset.kind === 'individual' ? '개인전' : '더블 · 2~3인 1팀'}
            </span>
          </div>
          <div className="event-tools">
            <div className="seg" role="radiogroup" aria-label="기록 방식">
              <button
                className={cls('seg-btn', ev.scoreMode === 'time' && 'active')}
                onClick={() => dispatch({ type: 'event/scoreMode', id: ev.id, mode: 'time' })}
                title="기록 시간 비교 — 짧은 시간이 이기는 스태킹 공식 방식"
              >
                ⏱ 기록(시간)
              </button>
              <button
                className={cls('seg-btn', ev.scoreMode === 'sets' && 'active')}
                onClick={() => dispatch({ type: 'event/scoreMode', id: ev.id, mode: 'sets' })}
                title="세트 승패 판정 — 많은 세트가 이김"
              >
                🎯 세트
              </button>
            </div>
            {ev.matches && (
              <button
                className="btn ghost-danger"
                onClick={() =>
                  askConfirm({
                    title: '대진표 초기화',
                    message: `“${preset.name}”의 대진표와 모든 결과를 삭제합니다. 팀 구성은 유지됩니다.`,
                    danger: true,
                    confirmLabel: '대진표 초기화',
                    onConfirm: () => dispatch({ type: 'event/reset', id: ev.id }),
                  })
                }
              >
                ↺ 초기화
              </button>
            )}
          </div>
        </div>

        {teams.length < 2 ? (
          preset.kind === 'double' ? (
            state.athletes.length < 2 ? (
              <div className="empty">더블 대회를 하려면 ① 참가자 등록에서 2명 이상 등록하세요.</div>
            ) : (
              <TeamBuilder ev={ev} />
            )
          ) : (
            <div className="empty">
              이 종목에 참가할 선수가 {teams.length}명입니다. 최소 2명 필요해요.
              <br />
              ① 참가자 등록에서 명단을 확인하세요.
            </div>
          )
        ) : !ev.matches ? (
          preset.kind === 'double' ? (
            <TeamBuilder ev={ev} />
          ) : (
            <IndividualParticipation ev={ev} />
          )
        ) : null}

        {teams.length >= 2 && !ev.matches && (
          <div className="setup-wrap">
            <BracketSetup ev={ev} teamCount={teams.length} />
          </div>
        )}

        {ev.matches && (
          <div className="board-wrap">
            <div className="board-status">
              <span className="chip">
                {ev.matches.reduce((n, m) => n + (m.decided ? 1 : 0), 0)} / {ev.matches.length} 경기 완료
              </span>
              <span className="chip">
                {ev.scoreMode === 'time' ? '⏱ 짧은 기록 승리' : '🎯 세트 승패'} ·{' '}
                {ev.seedMode === 'order' ? '시드 배치' : '무작위 배치'}
              </span>
              <button
                className="btn shuffle-seed"
                title="대진표를 무작위로 다시 섞습니다 — 부전승(BYE)은 매치마다 하나씩 균등하게 분산되고, 진행 중인 경기 기록은 사라집니다."
                onClick={() =>
                  askConfirm({
                    title: '대진 무작위 재배치',
                    message:
                      '대진표를 무작위로 다시 섞습니다. 지금까지 진행한 경기의 기록·승자·진출 결과가 모두 사라지고, 무작위 배치로 새 대진표가 만들어집니다. 계속할까요?',
                    danger: true,
                    confirmLabel: '대진 다시 섞기',
                    onConfirm: () => dispatch({ type: 'event/reseedRandom', id: ev.id }),
                  })
                }
              >
                🎲 대진 무작위로 다시 섞기
              </button>
            </div>
            <BracketBoard ev={ev} mode="edit" />
            <p className="hint">
              카드 클릭 = <b>현재 경기 지정</b> (빔프로젝터 모드의 Now Playing 표시) · 이긴 쪽 이름 클릭 ={' '}
              <b>승리</b> · 점수는 <b>⏱ 기록 입력</b>에서 선택 저장합니다.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
