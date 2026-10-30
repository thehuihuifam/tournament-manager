import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface ConfirmRequest {
  title: string;
  message: string;
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface UICtx {
  askConfirm: (req: ConfirmRequest) => void;
}

const Ctx = createContext<UICtx | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  const askConfirm = useCallback((r: ConfirmRequest) => setReq(r), []);

  // 확인 콜백은 상태 업데이터가 아니라 이벤트 핸들러에서 "정확히 한 번" 실행한다.
  // (업데이터 안에서 실행하면 React StrictMode에서 두 번 호출될 수 있다)
  const close = (ok: boolean) => {
    const current = req;
    setReq(null);
    if (ok && current) current.onConfirm();
  };

  // ESC로 취소 — 발표 모드 종료(전역 ESC)보다 먼저 처리되도록 캡처 단계에서 받는다.
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setReq(null);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [req]);

  return (
    <Ctx.Provider value={{ askConfirm }}>
      {children}
      {req && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-title" className={req.danger ? 'modal-title danger' : 'modal-title'}>
              {req.title}
            </h3>
            <p id="confirm-message" className="modal-msg">
              {req.message}
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => close(false)}>
                취소
              </button>
              <button
                className={req.danger ? 'btn danger' : 'btn primary'}
                onClick={() => close(true)}
                autoFocus
              >
                {req.confirmLabel ?? '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): UICtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used within UIProvider');
  return ctx;
}
