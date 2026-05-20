import { useEffect, useState } from 'react';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

function intervalFor(deltaMs: number): number {
  if (deltaMs < MINUTE_MS) return 5 * SECOND_MS;
  if (deltaMs < HOUR_MS) return 30 * SECOND_MS;
  return 5 * MINUTE_MS;
}

export function useRelativeTime(date: Date | null | undefined): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!date) return;
    const id = window.setInterval(() => {
      setNow(new Date());
    }, intervalFor(Date.now() - date.getTime()));
    return () => window.clearInterval(id);
  }, [date]);

  return now;
}
