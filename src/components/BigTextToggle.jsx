import { useEffect, useState } from 'react';

const TOGGLE_KEY = 'stacking-readability-bigtext';

/**
 * 큰 글자 모드 토글 (우하단 플로팅 버튼)
 * 가독성 패치 코드 II의 React 이식본 — 동작·문구·저장 키 동일.
 * html.big-text 클래스에 대한 스타일은 index.css(I-9)에 정의.
 */
export default function BigTextToggle() {
  const [bigText, setBigText] = useState(() => {
    try {
      return localStorage.getItem(TOGGLE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('big-text', bigText);
    try {
      localStorage.setItem(TOGGLE_KEY, bigText ? '1' : '0');
    } catch {
      /* 저장 실패 시 무시 */
    }
  }, [bigText]);

  return (
    <button
      type="button"
      aria-pressed={bigText ? 'true' : 'false'}
      onClick={() => setBigText((v) => !v)}
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 50,
        padding: '10px 16px',
        borderRadius: 9999,
        background: '#1e293b',
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 700,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        border: 'none',
      }}
    >
      {(bigText ? '🔍 ' : '🔎 ') + (bigText ? '큰 글자 끄기' : '큰 글자 켜기')}
    </button>
  );
}
