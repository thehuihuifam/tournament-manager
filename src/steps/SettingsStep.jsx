import OptionCard from '../components/OptionCard.jsx';
import { bracketSize } from '../lib/tournament.js';

/**
 * 2단계: 브래킷 설정 (자동 계산 미리보기 + 시드/부전승 방식 선택)
 */
export default function SettingsStep({
  players,
  seedMode,
  setSeedMode,
  byeMode,
  setByeMode,
  onBack,
  onGenerate,
}) {
  const count = players.length;
  const size = bracketSize(count);
  const byes = size - count;
  const rounds = Math.log2(size);

  return (
    <div className="space-y-5">
      {/* 자동 계산 요약 */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 p-6 text-white shadow-lg shadow-blue-200">
        <p className="text-sm font-bold opacity-80">브래킷 자동 계산</p>
        <h2 className="mt-1 text-3xl font-black">
          {size}강 브래킷 <span className="opacity-60">|</span> 부전승 {byes}명
        </h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1">참가자 {count}명</span>
          <span className="rounded-full bg-white/20 px-3 py-1">총 {rounds}라운드</span>
          <span className="rounded-full bg-white/20 px-3 py-1">
            총 경기 {count - 1}경기
          </span>
        </div>
      </div>

      {/* 시드 배정 방식 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-black text-slate-800">🎲 시드 배정 방식</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <OptionCard
            active={seedMode === 'order'}
            title="① 현재 순서 유지"
            desc="등록된 번호 순서 그대로 배치합니다."
            onClick={() => setSeedMode('order')}
          />
          <OptionCard
            active={seedMode === 'random'}
            title="② 랜덤 섞기 🔀"
            desc="참가자를 무작위로 섞어 배치합니다."
            onClick={() => setSeedMode('random')}
          />
          <OptionCard
            active={seedMode === 'gender'}
            title="③ 성별 교차 배치"
            desc="남·여를 번갈아 배치합니다."
            onClick={() => setSeedMode('gender')}
          />
        </div>
      </div>

      {/* 부전승 배정 방식 */}
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 font-black text-slate-800">🛡 부전승 배정 방식</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <OptionCard
            active={byeMode === 'top'}
            title="① 상위 시드에게 부전승"
            desc={`앞 순번 ${byes}명이 1라운드를 자동 통과합니다.`}
            onClick={() => setByeMode('top')}
          />
          <OptionCard
            active={byeMode === 'random'}
            title="② 랜덤 배정"
            desc={`무작위 ${byes}명에게 부전승을 부여합니다.`}
            onClick={() => setByeMode('random')}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-2xl bg-white px-6 py-4 font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
        >
          ← 이전
        </button>
        <button
          onClick={onGenerate}
          className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-8 py-4 text-lg font-black text-white shadow-lg shadow-blue-200 hover:brightness-110 active:scale-95"
        >
          ⚡ 브래킷 생성
        </button>
      </div>
    </div>
  );
}
