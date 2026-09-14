import PlayerRow from './PlayerRow.jsx';
import { roundName } from '../lib/tournament.js';

/**
 * 매치 카드 (클릭 → 승자 선택 모달)
 * 코드 III-2: 스크린리더용 aria-label 완전문 포함
 */
export default function MatchCard({ match, totalRounds, onClick }) {
  const playable =
    !match.p1Pending && !match.p2Pending && match.p1 && match.p2;
  const live = playable && !match.winner;

  if (!match.p1 && !match.p2 && !match.p1Pending && !match.p2Pending) {
    return <div className="h-[76px] w-[210px] opacity-0" />;
  }

  const label =
    `${roundName(totalRounds, match.round)} ${match.index + 1}경기: ` +
    `${match.p1 ? match.p1.name : '미정'} 대 ${match.p2 ? match.p2.name : '미정'}` +
    (match.winner
      ? `, 승자 ${match.winner.name}`
      : match.p1 && match.p2
        ? ', 승자 미정'
        : '');

  return (
    <button
      onClick={onClick}
      disabled={!playable}
      aria-label={label}
      className={`w-[210px] overflow-hidden rounded-xl border-2 bg-white text-left shadow-sm transition ${
        match.winner
          ? 'border-emerald-300 bg-emerald-50/50'
          : live
            ? 'live-match border-yellow-400 hover:-translate-y-0.5 hover:shadow-md'
            : 'border-slate-200'
      } ${playable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <PlayerRow
        player={match.p1}
        pending={match.p1Pending}
        decided={!!match.winner}
        isWinner={!!match.winner && !!match.p1 && match.winner.id === match.p1.id}
      />
      <div className="h-px bg-slate-200" />
      <PlayerRow
        player={match.p2}
        pending={match.p2Pending}
        decided={!!match.winner}
        isWinner={!!match.winner && !!match.p2 && match.winner.id === match.p2.id}
      />
    </button>
  );
}
