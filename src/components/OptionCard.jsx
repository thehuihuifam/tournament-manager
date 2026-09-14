/**
 * 설정 화면의 라디오형 옵션 카드
 */
export default function OptionCard({ active, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-4 text-left transition ${
        active
          ? 'border-blue-600 bg-blue-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-blue-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            active ? 'border-blue-600' : 'border-slate-300'
          }`}
        >
          {active && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
        </span>
        <span className="font-bold text-slate-800">{title}</span>
      </div>
      <p className="mt-1 pl-7 text-sm text-slate-500">{desc}</p>
    </button>
  );
}
