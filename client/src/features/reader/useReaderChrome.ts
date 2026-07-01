import { useCallback, useEffect, useRef, useState } from 'react';

const HIDE_DELAY_MS = 2500;

export function useReaderChrome(locked = false) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    if (!locked) {
      timer.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    }
  }, [locked]);

  // When a panel opens (locked=true), cancel the hide timer and stay visible
  useEffect(() => {
    if (locked) {
      setVisible(true);
      clearTimeout(timer.current);
    } else {
      timer.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    }
    return () => clearTimeout(timer.current);
  }, [locked]);

  useEffect(() => {
    // Navigation keys are used for page turns — they should NOT wake the chrome
    const NAV_KEYS = new Set(['ArrowLeft', 'ArrowRight', ' ', 'Backspace']);
    const onKey = (e: KeyboardEvent) => { if (!NAV_KEYS.has(e.key)) show(); };

    const opts = { passive: true } as const;
    window.addEventListener('mousemove',  show,  opts);
    window.addEventListener('touchstart', show,  opts);
    window.addEventListener('keydown',    onKey, opts);
    show();
    return () => {
      window.removeEventListener('mousemove',  show);
      window.removeEventListener('touchstart', show);
      window.removeEventListener('keydown',    onKey);
      clearTimeout(timer.current);
    };
  }, [show]);

  return { visible, show };
}
