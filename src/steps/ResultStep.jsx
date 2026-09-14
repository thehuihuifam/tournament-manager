import GenderBadge from '../components/GenderBadge.jsx';
import { roundName } from '../lib/tournament.js';
import { exportBracketPng } from '../lib/pngExport.js';

/**
 * 4단계: 최종 결과 (순위 + 전체 매치 표 + PNG 저장)
 */
export default function ResultStep({ rounds, onBack, onRestart }) {
  const totalRounds = rounds.length;
  const finalMatch = rounds[totalRounds - 1][0];
  const champion = finalMatch.winner;
  const runnerUp = finalMatch.loser;
  const thirdPlace = (totalRounds >= 2 ? rounds[totalRounds - 2] : [])
    .map((mm) => mm.loser)
    .filter(Boolean);
  const played = rounds.flat().filter((mm) => !mm.auto && mm.winner && mm.p1 && mm.p2);

  const ranks = [
    { rank: '🥇 1위 (우승)', players: champion ? [champion] : [], cls: 'from-amber-400 to-yellow-300' },
    { rank: '🥈 2위 (준우승)', players: runnerUp ? [runnerUp] : [], cls: 'from-slate-300 to-slate-200' },
    { rank: '🥉 공동 3위', players: thirdPlace, cls: 'from-orange-300 to-amber-200' },
  ];

  return (
    <div className="space-y-5">
      {/* 우승 배너 */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-sky-500 p-8 text-center text-white shadow-lg shadow-blue-200">
        <div className="text-6xl">🏆</div>
        <p className="mt-2 text-sm font-black tracking-widest opacity-80">최종 우승</p>
        <h2 className="text-4xl font-black">{champion?.name ?? '-'}</h2>
      </div>

      {/* 순위 카드 */}
      <div className="grid gap-3 md:grid-cols-3">
        {ranks.map((entry) => (
          <div
            key={entry.rank}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div
              className={`mb-3 rounded-xl bg-gradient-to-r ${entry.cls} px-3 py-1.5 text-sm font-black text-slate-800`}
            >
              {entry.rank}
            </div>
            <div className="space-y-2">
              {entry.players.length === 0 && (
                <p className="text-sm text-slate-400">-</p>
              )}
              {entry.players.map((player) => (
                <div key={player.id} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                    {player.no}
                  </span>
                  <span className="flex-1 font-bold text-slate-800">{player.name}</span>
                  <GenderBadge g={player.gender} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 전체 매치 결과 */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-5 py-4 font-black text-slate-800">
          📋 전체 매치 결과{' '}
          <span className="text-slate-400">({played.length}경기)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">라운드</th>
                <th className="px-4 py-3 text-left">매치</th>
                <th className="px-4 py-3 text-left">승자</th>
                <th className="px-4 py-3 text-left">패자</th>
              </tr>
            </thead>
            <tbody>
              {played.map((match) => (
                <tr key={match.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-blue-600">
                    {roundName(totalRounds, match.round)}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{match.index + 1}경기</td>
                  <td className="px-4 py-3 font-black text-slate-800">
                    {match.winner?.gender === 'M' ? '🔵' : '🔴'} {match.winner?.name}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {match.loser?.gender === 'M' ? '🔵' : '🔴'} {match.loser?.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onBack}
          className="rounded-2xl bg-white px-6 py-3 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← 브래킷으로
        </button>
        <button
          onClick={() => exportBracketPng(rounds, '스포츠 스태킹 1vs1 토너먼트')}
          className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3 font-black text-white shadow-lg shadow-blue-200 hover:brightness-110 active:scale-95"
        >
          🖼 브래킷 이미지로 저장 (PNG)
        </button>
        <button
          onClick={() => confirm('모든 데이터를 초기화하고 처음부터 다시 시작할까요?') && onRestart()}
          className="rounded-2xl bg-red-50 px-6 py-3 font-bold text-red-600 hover:bg-red-100"
        >
          🔄 처음부터 다시
        </button>
      </div>
    </div>
  );
}
