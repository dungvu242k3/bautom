import { useEffect, useMemo, useState } from 'react';
import { secondsLeft } from './gameRules';
import { clockOffset } from './supabaseClient';

export function useCountdown(endsAt?: string | null) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset), 300);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => (endsAt ? secondsLeft(endsAt, now) : 0), [endsAt, now]);
}
