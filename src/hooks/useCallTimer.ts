import { useEffect, useRef, useState } from 'react';

function format(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Counts up from the moment `active` first becomes true.
 * Returns '' while still waiting for the first remote participant.
 */
export function useCallTimer(active: boolean): string {
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    startedRef.current = true;
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  return startedRef.current ? format(elapsed) : '';
}
