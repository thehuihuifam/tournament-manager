import { cls } from '../format';

export function PodiumCard({
  rank,
  label,
  name,
  names,
  big,
}: {
  rank: 1 | 2 | 3;
  label: string;
  name?: string | null;
  names?: string[];
  big?: boolean;
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  return (
    <div className={cls('podium-card', `rank-${rank}`, big && 'big')}>
      <span className="podium-medal" aria-hidden>
        {medal}
      </span>
      <span className="podium-label">{label}</span>
      {names ? (
        <div className="podium-names">
          {names.map((n, i) => (
            <span key={i} className="podium-name">
              {n}
            </span>
          ))}
        </div>
      ) : (
        <span className="podium-name">{name ?? '—'}</span>
      )}
    </div>
  );
}
