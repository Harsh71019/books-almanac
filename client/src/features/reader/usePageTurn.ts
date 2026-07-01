import { useRef, useState, useCallback } from 'react';
import type React from 'react';

const EXIT_MS  = 140;
const ENTER_MS = 210;

type Phase = 'idle' | 'exit-fwd' | 'exit-back' | 'enter-fwd' | 'enter-back';

// Phase → CSS. enter-* phases use transition:none so the container snaps to
// its entry position; the slide-in transition fires on the next 'idle' set.
const PHASE_STYLE: Record<Phase, React.CSSProperties> = {
  idle: {
    transform:  'translateX(0)',
    opacity:    1,
    transition: `transform ${ENTER_MS}ms cubic-bezier(0.22,1,0.36,1), opacity ${ENTER_MS}ms ease-out`,
  },
  'exit-fwd':   { transform: 'translateX(-4%)', opacity: 0, transition: `transform ${EXIT_MS}ms ease-in, opacity ${EXIT_MS}ms ease-in` },
  'exit-back':  { transform: 'translateX(4%)',  opacity: 0, transition: `transform ${EXIT_MS}ms ease-in, opacity ${EXIT_MS}ms ease-in` },
  'enter-fwd':  { transform: 'translateX(4%)',  opacity: 0, transition: 'none' },
  'enter-back': { transform: 'translateX(-4%)', opacity: 0, transition: 'none' },
};

export function usePageTurn(
  rawPrev: () => void,
  rawNext: () => void,
  disabled: boolean,
) {
  const [phase, setPhase] = useState<Phase>('idle');
  const busy = useRef(false);

  const go = useCallback((dir: 'fwd' | 'back') => {
    if (busy.current || disabled) return;
    busy.current = true;
    setPhase(dir === 'fwd' ? 'exit-fwd' : 'exit-back');
    setTimeout(() => {
      if (dir === 'fwd') rawNext(); else rawPrev();
      setPhase(dir === 'fwd' ? 'enter-fwd' : 'enter-back');
      // Double rAF: first commits the snap (transition:none), second starts slide-in
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setPhase('idle');
        setTimeout(() => { busy.current = false; }, ENTER_MS);
      }));
    }, EXIT_MS);
  }, [rawNext, rawPrev, disabled]);

  return {
    triggerNext:   useCallback(() => go('fwd'),  [go]),
    triggerPrev:   useCallback(() => go('back'), [go]),
    pageAnimStyle: PHASE_STYLE[phase],
  };
}
