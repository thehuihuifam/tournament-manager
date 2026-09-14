import { useMemo, useState } from 'react';
import MatchCard from '../components/MatchCard.jsx';
import Confetti from '../components/Confetti.jsx';
import { countProgress, roundName } from '../lib/tournament.js';

/**
 * 3단계: 토너먼트 진행 (브래킷 + 승자 선택 모달 + 우승 셀레브레이션 오버레이)
 */
export default function BracketStep({ rounds, onPick, onReset, onBack, onFinish }) {
  const [selected, setSelected] = useState(null);
  const totalRounds = rounds.length;
  const progress = useMemo(() => countProgress(rounds), [rounds]);
  const champion = rounds[totalRounds - 1]?.[0]?.winner ?? null;
  const [celebrationSeen, setCelebrationSeen] = useState(false);

  // 아직 승자가 없는 매치가 존재하는 가장 앞 라운드
  const currentRound = useMemo(() => {
    for (let r = 0; r < rounds.length; r++) {
      if (
        rounds[r].some(
          (mm) =>
            !mm.winner && !(!mm.p1 && !mm.p2 && !mm.p1Pending && !mm.p2Pending),
        )
      ) {
        return r;
      }
    }
    return rounds.length - 1;
  }, [rounds]);

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 진행 현황판 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-black text-slate-800">
              {currentRound + 1}라운드{' '}
              <span className="text-slate-300">|</span>{' '}
              <span className="text-blue-600">{roundName(totalRounds, currentRound)}</span>
            </div>
            <p className="text-sm text-slate-500">매치 카드를 클릭해 승자를 선택하세요</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-800">
              {progress.done} <span className="text-slate-300">/</span> {progress.total}
            </div>
            <p className="text-xs font-bold text-slate-400">완료 경기</p>
          </div>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 브래킷 */}
      <div className="scroll-thin overflow-x-auto rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div id="bracket-root" className="flex min-w-max gap-8">
          {rounds.map((matches, r) => (
            <div key={r} className="flex flex-col">
              <div className="mb-3 text-center text-sm font-black text-slate-500">
                {roundName(totalRounds, r)}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {matches.map((match) => (
                  <div key={match.id} className="flex items-center">
                    <MatchCard
                      match={match}
                      totalRounds={totalRounds}
                      onClick={() => setSelected(match)}
                    />
                    {r < rounds.length - 1 && (
                      <div className="h-px w-6 shrink-0 bg-slate-200" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {champion && (
            <div className="flex flex-col justify-center">
              <div className="mb-3 text-center text-sm font-black text-amber-500">
                우승
              </div>
              <div className="flex flex-1 items-center">
                <div className="w-[210px] rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-4 text-center">
                  <div className="text-2xl">🏆</div>
                  <div className="text-lg font-black text-amber-700">{champion.name}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onBack}
          className="rounded-2xl bg-white px-6 py-3 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← 설정으로
        </button>
        <button
          onClick={onFinish}
          disabled={!champion}
          className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3 font-black text-white shadow-lg shadow-blue-200 hover:brightness-110 active:scale-95 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          📄 결과 보기
        </button>
      </div>

      {/* 승자 선택 모달 */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="pop-in w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-xs font-bold text-blue-600">
              {roundName(totalRounds, selected.round)} · {selected.index + 1}경기
            </p>
            <h3 className="mt-1 mb-5 text-center text-xl font-black text-slate-800">
              승자를 선택하세요
            </h3>
            <div className="space-y-3">
              {[selected.p1, selected.p2].map(
                (player) =>
                  player && (
                    <button
                      key={player.id}
                      onClick={() => {
                        onPick(selected.id, player.id);
                        setSelected(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition hover:-translate-y-0.5 ${
                        selected.winner?.id === player.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      <span className="text-xl">
                        {player.gender === 'M' ? '🔵' : '🔴'}
                      </span>
                      <span className="flex-1 text-lg font-black text-slate-800">
                        {player.name}
                      </span>
                      <span className="text-sm text-slate-400">({player.no})</span>
                      {selected.winner?.id === player.id && <span>✅</span>}
                    </button>
                  ),
              )}
            </div>
            <div className="mt-5 flex gap-2">
              {selected.winner && (
                <button
                  onClick={() => {
                    onReset(selected.id);
                    setSelected(null);
                  }}
                  className="flex-1 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-100"
                >
                  ↩️ 결과 취소
                </button>
              )}
              <button
                onClick={() => setSelected(null)}
                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 우승 celebration 오버레이 (1회) */}
      {champion && !celebrationSeen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-900/80 p-4">
          <Confetti />
          <div className="pop-in relative z-10 w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
            <div className="text-7xl">🏆</div>
            <p className="mt-4 text-sm font-black tracking-widest text-blue-600">
              CHAMPION
            </p>
            <h2 className="mt-2 text-4xl font-black text-slate-900">{champion.name}</h2>
            <p className="mt-1 text-slate-500">
              {champion.gender === 'M' ? '🔵 남' : '🔴 여'} · 참가번호 {champion.no}
            </p>
            <div className="mt-7 flex gap-3">
              <button
                onClick={() => setCelebrationSeen(true)}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-bold text-slate-600 hover:bg-slate-200"
              >
                브래킷 보기
              </button>
              <button
                onClick={() => {
                  setCelebrationSeen(true);
                  onFinish();
                }}
                className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-3 font-black text-white"
              >
                결과 보기 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
