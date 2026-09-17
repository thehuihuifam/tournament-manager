import { useRef, useState } from 'react';
import { useStore } from '../store';
import { cls } from '../format';
import { restoreFromJSON, serializeState } from '../store';
import { Step } from '../types';

const STEPS: { id: Step; label: string }[] = [
  { id: 'participants', label: '① 참가자 등록' },
  { id: 'brackets', label: '② 종목별 대진' },
  { id: 'results', label: '③ 최종 결과' },
];

type Banner = { kind: 'ok' | 'err'; text: string } | null;

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
  const [banner, setBanner] = useState<Banner>(null);
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
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      let isJson = true;
      try {
        JSON.parse(raw);
      } catch {
        isJson = false;
      }
      const restored = restoreFromJSON(raw);
      if (!restored) {
        setBanner({
          kind: 'err',
          text: !isJson
            ? '선택한 파일은 JSON 형식이 아닙니다. tournament-YYYYMMDD-HHmm.json 파일을 선택해 주세요.'
            : '이 파일은 이 앱에서 만든 백업이 아니거나 구버전 형식입니다. 파일 내용을 확인해 주세요.',
        });
        return;
      }
      dispatch({ type: 'backup/import', data: restored });
      const eventCount = restored.events.length;
      setBanner({
        kind: 'ok',
        text: `✅ 백업 파일을 불러왔습니다. ${restored.athletes.length}명의 참가자와 ${eventCount}개 종목 데이터가 복원되었습니다.`,
      });
    };
    reader.onerror = () =>
      setBanner({
        kind: 'err',
        text: '선택한 파일은 JSON 형식이 아닙니다. tournament-YYYYMMDD-HHmm.json 파일을 선택해 주세요.',
      });
    reader.readAsText(file);
  };

  return (
    <>
      {banner && (
        <div
          role="alert"
          className={cls('import-banner', banner.kind === 'err' ? 'banner-err' : 'banner-ok')}
          style={{
            padding: '8px 36px 8px 12px',
            background: banner.kind === 'err' ? '#ffdddd' : '#ddffdd',
            color: banner.kind === 'err' ? '#a00' : '#063',
            fontWeight: 'bold',
            position: 'relative',
          }}
        >
          {banner.text}
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="알림 닫기"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              fontSize: '1.1em',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}
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
          <span className="chip" aria-label={`등록 ${state.athletes.length}명, 남자 ${m}명, 여자 ${f}명`}>
            등록 <b>{state.athletes.length}</b>명
            <i className="chip-dot" aria-hidden="true" />
            <b aria-hidden="true">🔵{m}</b>
            <b aria-hidden="true">🔴{f}</b>
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
            accept="application/json,.json"
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
    </>
  );
}
