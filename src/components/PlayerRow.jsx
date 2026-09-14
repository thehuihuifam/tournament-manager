/**
 * 매치 카드 내 선수 1행 (대기 / 선수 / BYE 3상태)
 * 코드 III-1: 잘린 이름 확인용 title 툴팁 포함
 */
export default function PlayerRow({ player, pending, isWinner, decided }) {
  if (pending) {
    return (
      <div className="px-3 py-2 text-sm italic text-slate-300">— 진출자 대기 —</div>
    );
  }
  if (!player) {
    return (
      <div className="px-3 py-2 text-sm font-bold tracking-wider text-slate-300">
        BYE
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 text-sm ${
        decided && !isWinner
          ? 'text-slate-400 line-through decoration-slate-300'
          : 'text-slate-800'
      }`}
    >
      <span className={player.gender === 'M' ? 'text-blue-500' : 'text-rose-500'}>
        {player.gender === 'M' ? '🔵' : '🔴'}
      </span>
      <span
        title={player.name}
        className={`flex-1 truncate ${isWinner ? 'font-black text-blue-700' : 'font-medium'}`}
      >
        {player.name}
      </span>
      <span className="text-xs text-slate-400">({player.no})</span>
      {isWinner && <span className="text-xs">✅</span>}
    </div>
  );
}
