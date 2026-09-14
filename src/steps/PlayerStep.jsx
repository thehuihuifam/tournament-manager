import { useMemo, useRef, useState } from 'react';
import GenderBadge from '../components/GenderBadge.jsx';
import { generateId, parseGender } from '../lib/tournament.js';
import { SAMPLE_TSV } from '../lib/sampleData.js';

/**
 * 1단계: 참가자 등록 (개별 입력 / 일괄 붙여넣기)
 *
 * 붙여넣기 파서 규칙 (원본과 동일):
 * - 줄 단위 분리, 빈 줄 무시
 * - 첫 줄이 [번호/이름] 헤더면 스킵
 * - 탭·콤마·공백 구분, 3열=[번호,이름,성별], 2열=[이름,성별]+번호 자동 부여
 * - 열 부족·번호 파싱 실패·성별 미인식은 줄 단위 오류로 보고
 */
export default function PlayerStep({ players, setPlayers, onNext }) {
  const [tab, setTab] = useState('single');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('M');
  const nextNo = useMemo(
    () => (players.length ? Math.max(...players.map((p) => p.no)) + 1 : 1),
    [players],
  );
  const [noText, setNoText] = useState(String(nextNo));
  const [noTouched, setNoTouched] = useState(false);
  const nameRef = useRef(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState('replace');
  const [errors, setErrors] = useState([]);
  const [parsedCount, setParsedCount] = useState(null);

  const noValue = noTouched ? noText : String(nextNo);

  const addPlayer = () => {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    const parsedNo = parseInt(noValue, 10);
    setPlayers([
      ...players,
      {
        id: generateId(),
        no: Number.isFinite(parsedNo) ? parsedNo : nextNo,
        name: name.trim(),
        gender,
      },
    ]);
    setName('');
    setNoText('');
    setNoTouched(false);
    nameRef.current?.focus();
  };

  const importBulk = () => {
    const lines = bulkText.split(/\r?\n/);
    const errs = [];
    const parsed = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const cols = trimmed.split(/[\t,]+|\s{1,}/).filter(Boolean);
      if (idx === 0 && /번호/.test(cols[0] ?? '') && /이름/.test(cols[1] ?? '')) return;
      if (cols.length < 2) {
        errs.push({ line: idx + 1, text: line, reason: '열이 부족합니다 (번호/이름/성별)' });
        return;
      }
      let noStr;
      let nameStr;
      let genderStr;
      if (cols.length >= 3) {
        [noStr, nameStr, genderStr] = cols;
      } else {
        noStr = String(parsed.length + 1);
        [nameStr, genderStr] = cols;
      }
      const no = parseInt(noStr, 10);
      if (!Number.isFinite(no)) {
        errs.push({
          line: idx + 1,
          text: line,
          reason: `번호 "${noStr}" 를 숫자로 읽을 수 없습니다`,
        });
        return;
      }
      const g = parseGender(genderStr);
      if (!g) {
        errs.push({
          line: idx + 1,
          text: line,
          reason: `성별 "${genderStr}" 은(는) 남/여 로 인식할 수 없습니다`,
        });
        return;
      }
      parsed.push({ id: generateId(), no, name: nameStr, gender: g });
    });
    setErrors(errs);
    setParsedCount(parsed.length);
    if (parsed.length) {
      setPlayers(bulkMode === 'replace' ? parsed : [...players, ...parsed]);
    }
  };

  const removePlayer = (id) => setPlayers(players.filter((p) => p.id !== id));
  const maleCount = players.filter((p) => p.gender === 'M').length;

  return (
    <div className="space-y-5">
      {/* 입력 방식 탭 */}
      <div className="flex gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
        {[
          ['single', '✍️ 개별 입력'],
          ['bulk', '📋 일괄 붙여넣기'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'single' ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3 sm:grid-cols-[90px_1fr_auto_auto]">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">번호</label>
              <input
                value={noValue}
                onChange={(e) => {
                  setNoText(e.target.value);
                  setNoTouched(true);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">이름</label>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                placeholder="이름 입력 후 Enter"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">성별</label>
              <div className="flex h-[42px] items-center gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setGender('M')}
                  className={`h-full rounded-lg px-3 text-sm font-bold ${
                    gender === 'M' ? 'bg-blue-600 text-white' : 'text-slate-500'
                  }`}
                >
                  🔵 남
                </button>
                <button
                  onClick={() => setGender('F')}
                  className={`h-full rounded-lg px-3 text-sm font-bold ${
                    gender === 'F' ? 'bg-rose-500 text-white' : 'text-slate-500'
                  }`}
                >
                  🔴 여
                </button>
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={addPlayer}
                className="h-[42px] w-full rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow transition hover:bg-blue-700 active:scale-95 sm:w-auto"
              >
                + 추가
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-700">
            아래 형식으로 붙여넣기 (탭 또는 띄어쓰기로 구분)
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-500 ring-1 ring-slate-200">
            {`번호\t이름\t성별\n1\t고수아\t여\n2\t고은성\t남`}
          </pre>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={10}
            placeholder="여기에 붙여넣으세요..."
            className="w-full rounded-xl border border-slate-300 p-3 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-sm font-bold">
              <button
                onClick={() => setBulkMode('replace')}
                className={`rounded-lg px-3 py-1.5 ${
                  bulkMode === 'replace'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-slate-500'
                }`}
              >
                덮어쓰기
              </button>
              <button
                onClick={() => setBulkMode('append')}
                className={`rounded-lg px-3 py-1.5 ${
                  bulkMode === 'append'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-slate-500'
                }`}
              >
                기존에 추가
              </button>
            </div>
            <button
              onClick={importBulk}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 active:scale-95"
            >
              📥 불러오기
            </button>
            <button
              onClick={() => setBulkText(SAMPLE_TSV)}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-600 active:scale-95"
            >
              ✨ 샘플 데이터 불러오기 (22명)
            </button>
          </div>
          {parsedCount !== null && (
            <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              ✅ {parsedCount}명 파싱 성공
              {errors.length > 0 && ` · ⚠️ ${errors.length}개 행 오류`}
            </div>
          )}
          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((err) => (
                <div
                  key={err.line}
                  className="rounded-lg border-l-4 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-700"
                >
                  <b>{err.line}번째 줄 오류</b> — {err.reason}
                  <div className="mt-0.5 font-mono text-red-400">
                    {err.text || '(빈 줄)'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 등록 목록 */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <span className="text-lg font-black text-slate-800">
              현재 <span className="text-blue-600">{players.length}</span>명 등록됨
            </span>
            <span className="ml-2 text-sm text-slate-400">
              (🔵 남 {maleCount} · 🔴 여 {players.length - maleCount})
            </span>
          </div>
          <button
            onClick={() => confirm('참가자 전체를 삭제할까요?') && setPlayers([])}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-red-100 hover:text-red-600"
          >
            🗑 전체 삭제
          </button>
        </div>
        {players.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">
            아직 등록된 참가자가 없습니다. 위에서 추가해 주세요!
          </div>
        ) : (
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                  {player.no}
                </span>
                <span className="flex-1 truncate font-bold text-slate-800">
                  {player.name}
                </span>
                <GenderBadge g={player.gender} />
                <button
                  onClick={() => removePlayer(player.id)}
                  title={`${idx + 1}번째 삭제`}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-red-100 hover:text-red-600"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 다음 단계 CTA */}
      <div className="sticky bottom-4 flex justify-center">
        <button
          disabled={players.length < 2}
          onClick={onNext}
          className="w-full max-w-md rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-8 py-4 text-lg font-black text-white shadow-lg shadow-blue-200 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
        >
          🏆 토너먼트 생성하기 {players.length < 2 && '(최소 2명)'}
        </button>
      </div>
    </div>
  );
}
