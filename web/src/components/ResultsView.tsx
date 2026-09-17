import { useStore } from '../store';
import { podium } from '../bracket';
import { eventStatus, getTeams, presetOf, teamMap } from '../presets';
import { PodiumCard } from './Podium';

export function ResultsView() {
  const { state, dispatch } = useStore();
  return (
    <div className="results">
      <h2 className="results-title">🏆 종목별 최종 결과</h2>
      <div className="results-grid">
        {state.events.map((ev) => {
          const p = presetOf(ev.id);
          const st = eventStatus(ev);
          const res = ev.matches ? podium(ev.matches) : null;
          const teams = getTeams(state.athletes, ev, p.kind);
          const map = teamMap(teams);
          const nm = (id: string | null) => (id ? map.get(id)?.name ?? '—' : null);
          return (
            <section key={ev.id} className={`panel result-card st-${st}`}>
              <header className="result-head">
                <h3>{p.name}</h3>
                <span className={cls2(st)}>{st === 'done' ? '완료' : st === 'running' ? '진행 중' : '미시작'}</span>
              </header>
              {st === 'done' && res ? (
                <div className="podium">
                  <PodiumCard rank={2} label="준우승" name={nm(res.runnerUp)} />
                  <PodiumCard rank={1} label="우승" name={nm(res.winner)} />
                  <PodiumCard
                    rank={3}
                    label={res.third.length > 1 ? '공동 3위' : res.third.length === 1 ? '3위' : '—'}
                    names={res.third.length > 0 ? res.third.map((id) => map.get(id)?.name ?? '—') : undefined}
                    name={res.third.length === 1 ? nm(res.third[0]) : undefined}
                  />
                </div>
              ) : st === 'running' ? (
                <div className="result-running">
                  <button
                    className="btn primary"
                    onClick={() => dispatch({ type: 'ui/step', step: 'brackets' })}
                  >
                    ② 대진표로 이동 →
                  </button>
                </div>
              ) : (
                <p className="hint">아직 진행되지 않았습니다.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function cls2(st: 'none' | 'running' | 'done') {
  return `st-tag st-${st}`;
}
