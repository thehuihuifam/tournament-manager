/**
 * 성별 뱃지 (이모지 + 텍스트 병기로 색각이상 대응)
 */
export default function GenderBadge({ g }) {
  if (g === 'M') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
        🔵 남
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-600">
      🔴 여
    </span>
  );
}
