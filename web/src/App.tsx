import { useEffect, useRef } from 'react';
import { StoreProvider, useStore } from './store';
import { UIProvider } from './uic';
import { Header } from './components/Header';
import { ParticipantsView } from './components/ParticipantsView';
import { EventBoard } from './components/EventBoard';
import { ResultsView } from './components/ResultsView';
import { ProjectorView } from './components/ProjectorView';
import { cls } from './format';

function Shell() {
  const { state, dispatch, saveError } = useStore();
  const projectorRef = useRef(state.projector);
  projectorRef.current = state.projector;

  // 발표 모드 진입/종료 시 전체화면 API 연동
  useEffect(() => {
    if (state.projector) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [state.projector]);

  // ESC 키 또는 브라우저의 전체화면 종료 -> 발표 모드 해제 (고유착 방지)
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && projectorRef.current) {
        dispatch({ type: 'ui/projector', on: false });
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && projectorRef.current) {
        dispatch({ type: 'ui/projector', on: false });
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
    };
  }, [dispatch]);

  return (
    <div className={cls('app', state.projector && 'is-projector')}>
      {saveError && !state.projector && (
        <div role="alert" style={{ background: '#ffdddd', color: '#a00', padding: '8px 12px', fontWeight: 'bold' }}>
          저장 공간이 부족합니다. JSON 백업을 즉시 내보내세요.
        </div>
      )}
      {state.projector ? (
        <ProjectorView />
      ) : (
        <>
          <Header />
          <main className="main">
            {state.step === 'participants' && <ParticipantsView />}
            {state.step === 'brackets' && <EventBoard />}
            {state.step === 'results' && <ResultsView />}
          </main>
        </>
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </StoreProvider>
  );
}
