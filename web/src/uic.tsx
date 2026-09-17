import React, { createContext, useCallback, useContext, useState } from 'react';

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
  const close = useCallback((ok: boolean) => {
    setReq((cur) => {
      if (cur && ok) cur.onConfirm();
      return null;
    });
  }, []);

  return (
    <Ctx.Provider value={{ askConfirm }}>
      {children}
      {req && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h3 className={req.danger ? 'modal-title danger' : 'modal-title'}>{req.title}</h3>
            <p className="modal-msg">{req.message}</p>
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
