import { useEffect, useMemo, useState } from 'react';
import PlayerStep from './steps/PlayerStep.jsx';
import SettingsStep from './steps/SettingsStep.jsx';
import BracketStep from './steps/BracketStep.jsx';
import ResultStep from './steps/ResultStep.jsx';
import BigTextToggle from './components/BigTextToggle.jsx';
import {
  buildRounds,
  downstreamMatchIds,
  generateSlots,
} from './lib/tournament.js';
import { INITIAL_STATE, clearState, loadState, saveState } from './lib/storage.js';

const STEP_TITLES = ['참가자 등록', '브래킷 설정', '토너먼트 진행', '최종 결과'];

/**
 * 앱 셸: 단일 상태 객체 + localStorage 자동 저장/복원
 * state = { step, players, seedMode, byeMode, slotIds, results }
 */
export default function App() {
  const [state, setState] = useState(loadState);
  const { step, players, seedMode, byeMode, slotIds, results } = state;

  useEffect(() => {
    saveState(state);
  }, [state]);

  const patch = (part) => setState((prev) => ({ ...prev, ...part }));

  // slotIds → 선수 객체 (삭제된 선수는 null로 복원)
  const slots = useMemo(() => {
    if (!slotIds) return null;
    const byId = new Map(players.map((p) => [p.id, p]));
    return slotIds.map((id) => (id ? (byId.get(id) ?? null) : null));
  }, [slotIds, players]);

  const rounds = useMemo(() => (slots ? buildRounds(slots, results) : null), [slots, results]);

  const generate = () => {
    const created = generateSlots(players, seedMode, byeMode);
    patch({
      slotIds: created.map((p) => p?.id ?? null),
      results: {},
      step: 3,
    });
  };

  const pickWinner = (matchId, winnerId) => {
    if (!rounds) return;
    const next = { ...results, [matchId]: winnerId };
    for (const id of downstreamMatchIds(matchId, rounds.length)) delete next[id];
    patch({ results: next });
  };

  const resetResult = (matchId) => {
    if (!rounds) return;
    const next = { ...results };
    delete next[matchId];
    for (const id of downstreamMatchIds(matchId, rounds.length)) delete next[id];
    patch({ results: next });
  };

  const restart = () => {
    clearState();
    setState(INITIAL_STATE);
  };

  // 단계 이동 가드: 3단계는 브래킷 없이, 4단계는 우승 확정 없이, 2단계 이상은 2명 미만으로 불가
  const goStep = (target) => {
    if (target === 3 && !slotIds) return;
    if (target === 4 && !(rounds && rounds[rounds.length - 1][0].winner)) return;
    if (target >= 2 && players.length < 2) return;
    patch({ step: target });
  };

  return (
    <div className="min-h-screen bg-[#f6f9ff]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥤</span>
            <h1 className="text-lg font-black text-slate-900">
              스포츠 스태킹 <span className="text-blue-600">1vs1 토너먼트</span> 매니저
            </h1>
          </div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 sm:gap-2">
            {STEP_TITLES.map((title, idx) => {
              const num = idx + 1;
              const isCurrent = step === num;
              const isDone = step > num;
              return (
                <div key={title} className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => goStep(num)}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition sm:text-sm ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow'
                        : isDone
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                        isCurrent
                          ? 'bg-white/25'
                          : isDone
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200'
                      }`}
                    >
                      {isDone ? '✓' : num}
                    </span>
                    {title}
                  </button>
                  {num < 4 && <span className="text-slate-300">›</span>}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {step === 1 && (
          <PlayerStep
            players={players}
            setPlayers={(next) => patch({ players: next })}
            onNext={() => patch({ step: 2 })}
          />
        )}
        {step === 2 && (
          <SettingsStep
            players={players}
            seedMode={seedMode}
            setSeedMode={(next) => patch({ seedMode: next })}
            byeMode={byeMode}
            setByeMode={(next) => patch({ byeMode: next })}
            onBack={() => patch({ step: 1 })}
            onGenerate={generate}
          />
        )}
        {step === 3 &&
          (rounds ? (
            <BracketStep
              rounds={rounds}
              onPick={pickWinner}
              onReset={resetResult}
              onBack={() => patch({ step: 2 })}
              onFinish={() => patch({ step: 4 })}
            />
          ) : (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">
              브래킷이 아직 생성되지 않았습니다.
              <button
                onClick={() => patch({ step: 2 })}
                className="ml-2 font-bold text-blue-600"
              >
                설정으로 가기 →
              </button>
            </div>
          ))}
        {step === 4 &&
          (rounds ? (
            <ResultStep rounds={rounds} onBack={() => patch({ step: 3 })} onRestart={restart} />
          ) : (
            <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">
              결과가 없습니다.
            </div>
          ))}
      </main>

      <footer className="pb-8 text-center text-xs text-slate-400">
        진행 상태는 브라우저에 자동 저장됩니다 · 새로고침해도 복원돼요
      </footer>

      <BigTextToggle />
    </div>
  );
}
