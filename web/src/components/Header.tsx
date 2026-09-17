import { useRef } from 'react';
import { useStore } from '../store';
import { cls } from '../format';
import { restoreFromJSON, serializeState } from '../store';
import { Step } from '../types';

const STEPS: { id: Step; label: string }[] = [
  { id: 'participants', label: '① 참가자 등록' },
  { id: 'brackets', label: '② 종목별 대진' },
  { id: 'results', label: '③ 최종 결과' },
];

function tsStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

export function Header() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const m = state.athletes.filter((a) => a.gender === 'M').length;
  const f = state.athletes.length - m;

  const handleExport = () => {
    const json = serializeState(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament-${tsStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하게 초기화
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const restored = restoreFromJSON(String(reader.result ?? ''));
      if (!restored) {
        alert('올바른 백업 파일이 아닙니다');
        return;
      }
      dispatch({ type: 'backup/import', data: restored });
    };
    reader.onerror = () => alert('올바른 백업 파일이 아닙니다');
    reader.readAsText(file);
  };

  return (
    <header className="header">
      <div className="header-title">
        <span className="header-logo" aria-hidden>
          🥤
        </span>
        <div className="header-titles">
          <h1>스포츠스태킹 토너먼트 매니저</h1>
          <p>학교 체육관 빔프로젝터용 · 실시간 대진표 발표 시스템</p>
        </div>
      </div>
      <nav className="steps" aria-label="단계">
        {STEPS.map((s) => (
          <button
            key={s.id}
            className={cls('step', state.step === s.id && 'active')}
            onClick={() => dispatch({ type: 'ui/step', step: s.id })}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="header-right">
        <span className="chip">
          등록 <b>{state.athletes.length}</b>명
          <i className="chip-dot" />
          <b>🔵{m}</b>
          <b>🔴{f}</b>
        </span>
        <button className="proj-btn" onClick={handleExport} title="현재 대회 데이터를 JSON 파일로 내보냅니다">
          💾 내보내기
        </button>
        <button className="proj-btn" onClick={handleImportClick} title="JSON 백업 파일에서 데이터를 불러옵니다">
          📂 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="proj-btn"
          onClick={() => dispatch({ type: 'ui/projector', on: true })}
          title="네비게이션·편집 UI를 숨기고 대진표와 현재 경기를 전체화면으로 크게 띄웁니다"
        >
          📺 빔프로젝터 모드 <small>(전체화면)</small>
        </button>
      </div>
    </header>
  );
}
