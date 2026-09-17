import { useState } from 'react';
import { useStore } from '../store';
import { useConfirm } from '../uic';
import { autoPair } from '../bracket';
import { Gender, Team, TEvent } from '../types';
import { cls, teamAutoName, uid } from '../format';

/**
 * 더블 종목 팀 빌더.
 * - 성별 필터(전체/남/여) + [남-남/여-여 같은 성별 자동 페어링] + 무작위 페어링
 * - 드래그 또는 클릭으로 2인 1조 수동 조립
 * - 팀 순서 = 시드 순서 (A팀 = 1번 시드)
 */
export function TeamBuilder({ ev }: { ev: TEvent }) {
  const { state, dispatch } = useStore();
  const { askConfirm } = useConfirm();
  const [filter, setFilter] = useState<'all' | Gender>('all');
  const [pending, setPending] = useState<string | null>(null); // 클릭 지정용 대기 선수
  const [dragOver, setDragOver] = useState<string | null>(null); // "teamId:slot"
  const [notice, setNotice] = useState<string | null>(null);

  const athletes = state.athletes;
  const inTeam = new Set(ev.teams.flatMap((t) => t.members));
  const pool = athletes
    .filter((a) => !inTeam.has(a.id))
    .filter((a) => filter === 'all' || a.gender === filter)
    .sort((x, y) => x.no - y.no);
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.name ?? '??';

  const setTeams = (teams: Team[]) => dispatch({ type: 'event/teams', id: ev.id, teams });

  const assign = (aid: string, teamId: string, slot: number, from?: { team: string; slot: number }) => {
    const teams = ev.teams.map((t) => ({ ...t, members: [...t.members] }));
    if (from) {
      const ft = teams.find((t) => t.id === from.team);
      if (ft) ft.members[from.slot] = '';
    }
    const t = teams.find((t) => t.id === teamId);
    if (!t) return;
    const occupant = t.members[slot] || '';
    if (from && occupant) {
      const ft = teams.find((x) => x.id === from.team);
      if (ft) ft.members[from.slot] = occupant; // 스왑
    }
    t.members[slot] = aid;
    setTeams(teams);
    setPending(null);
  };

  const unassign = (teamId: string, slot: number) => {
    const teams = ev.teams.map((t) => ({ ...t, members: [...t.members] }));
    const t = teams.find((x) => x.id === teamId);
    if (t) t.members[slot] = '';
    setTeams(teams);
  };

  const autoPairAll = (mode: 'same' | 'any') => {
    const src = athletes
      .filter((a) => filter === 'all' || a.gender === filter)
      .sort((x, y) => x.no - y.no);
    if (src.length < 2) {
      setNotice('페어링할 선수가 2명 미만입니다.');
      return;
    }
    const { pairs, leftover } = autoPair(src, mode);
    const next: Team[] = pairs.map((p, i) => {
      const existing = ev.teams.find(
        (t) => t.members.length === 2 && t.members.every((m) => p.includes(m)),
      );
      return existing ?? { id: uid('t'), name: teamAutoName(i), members: [...p] };
    });
    setTeams(next);
    const leftoverNames = leftover.map(nameOf).join(', ');
    setNotice(
      leftover.length > 0
        ? `⚠️ ${leftover.length}명이 홀수로 남았습니다: ${leftoverNames} (빈 슬롯에 드래그/클릭으로 수동 추가하세요)`
        : `✅ ${next.length}개 팀 자동 구성 완료! 팀 순서가 시드 순서가 됩니다.`,
    );
  };

  const onDrop = (teamId: string, slot: number, data: string) => {
    setDragOver(null);
    if (!data) return;
    const [aid, fromTeam, fromSlot] = data.split(':');
    if (!aid) return;
    assign(
      aid,
      teamId,
      slot,
      fromTeam ? { team: fromTeam, slot: Number(fromSlot) } : undefined,
    );
  };

  return (
    <div className="builder">
      <div className="builder-controls">
        <div className="seg" role="radiogroup" aria-label="성별 필터">
          <button className={cls('seg-btn', filter === 'all' && 'active')} onClick={() => setFilter('all')}>
            전체 {athletes.length}
          </button>
          <button
            className={cls('seg-btn', filter === 'M' && 'active')}
            onClick={() => setFilter('M')}
          >
            🔵 남자 {athletes.filter((a) => a.gender === 'M').length}
          </button>
          <button
            className={cls('seg-btn', filter === 'F' && 'active')}
            onClick={() => setFilter('F')}
          >
            🔴 여자 {athletes.filter((a) => a.gender === 'F').length}
          </button>
        </div>
        <div className="builder-pair">
          <button className="btn primary" onClick={() => autoPairAll('same')}>
            ⚡ 같은 성별 자동 페어링 (남-남 / 여-여)
          </button>
          <button className="btn" onClick={() => autoPairAll('any')}>
            🎲 무작위 페어링
          </button>
          <button
            className="btn ghost-danger"
            disabled={ev.teams.length === 0}
            onClick={() => {
              askConfirm({
                title: '팀 목록 비우기',
                message: '모든 팀 구성을 초기화합니다.',
                danger: true,
                onConfirm: () => setTeams([]),
              });
            }}
          >
            팀 비우기
          </button>
        </div>
      </div>
      {notice && <div className="builder-notice">{notice}</div>}

      <div className="builder-cols">
        <div className="builder-roster">
          <h3>
            미배정 선수 <small>{pool.length}명</small>
          </h3>
          {pool.length === 0 ? (
            <p className="hint">남은 선수가 없습니다. (상단 페어링 버튼으로 한 번에 구성하세요)</p>
          ) : (
            <div className="chips">
              {pool.map((a) => (
                <button
                  key={a.id}
                  className={cls('chip-athlete', pending === a.id && 'pending')}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', a.id)}
                  onClick={() => setPending(pending === a.id ? null : a.id)}
                  title="클릭 → 빈 슬롯 클릭, 또는 드래그로 팀에 넣기"
                >
                  <span className={a.gender === 'M' ? 'dot-m' : 'dot-f'} />
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="builder-teams">
          <div className="builder-teams-head">
            <h3>
              구성한 팀 <small>{ev.teams.length}개</small>
            </h3>
            <button className="btn small" onClick={() => setTeams([...ev.teams, { id: uid('t'), name: teamAutoName(ev.teams.length), members: ['', ''] }])}>
              ＋ 빈 팀 추가
            </button>
          </div>
          {ev.teams.length === 0 ? (
            <p className="hint">
              [⚡ 같은 성별 자동 페어링]을 누르거나, 왼쪽 선수 칩을 드래그해 조를 만드세요.
            </p>
          ) : (
            <ul className="team-list">
              {ev.teams.map((t, ti) => (
                <li key={t.id} className="team-card">
                  <span className="team-seed" title="시드 순위">
                    {ti + 1}
                  </span>
                  <div className="team-slots">
                    {[0, 1].map((slot) => {
                      const mem = t.members[slot] || '';
                      const key = `${t.id}:${slot}`;
                      return (
                        <div
                          key={key}
                          className={cls('team-slot', dragOver === key && 'over', mem && 'filled')}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(key);
                          }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            onDrop(t.id, slot, e.dataTransfer.getData('text/plain'));
                          }}
                          onClick={() => {
                            if (pending) assign(pending, t.id, slot);
                            else if (mem) unassign(t.id, slot);
                          }}
                          title={mem ? '클릭 → 팀에서 빼기' : '클릭 → 대기 중인 선수 배치'}
                        >
                          {mem ? (
                            <span
                              className="team-member"
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData('text/plain', `${mem}:${t.id}:${slot}`)}
                            >
                              <span className={athletes.find((a) => a.id === mem)?.gender === 'M' ? 'dot-m' : 'dot-f'} />
                              {nameOf(mem)}
                            </span>
                          ) : (
                            <span className="slot-empty">빈 슬롯</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <input
                    className="team-name"
                    value={t.name}
                    onChange={(e) =>
                      setTeams(ev.teams.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder="팀 이름"
                  />
                  <span className="team-move">
                    <button
                      disabled={ti === 0}
                      onClick={() => {
                        const arr = [...ev.teams];
                        [arr[ti - 1], arr[ti]] = [arr[ti], arr[ti - 1]];
                        setTeams(arr);
                      }}
                      title="시드 위로"
                    >
                      ↑
                    </button>
                    <button
                      disabled={ti === ev.teams.length - 1}
                      onClick={() => {
                        const arr = [...ev.teams];
                        [arr[ti + 1], arr[ti]] = [arr[ti], arr[ti + 1]];
                        setTeams(arr);
                      }}
                      title="시드 아래로"
                    >
                      ↓
                    </button>
                    <button
                      className="team-del"
                      onClick={() => setTeams(ev.teams.filter((x) => x.id !== t.id))}
                      title="팀 삭제"
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="hint">
            <b>팀 순서 = 시드 순서</b> (첫 팀이 1번 시드). 개인전은 참가번호 순서가 시드입니다.
          </p>
        </div>
      </div>
    </div>
  );
}
