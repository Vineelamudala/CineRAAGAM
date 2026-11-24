'use client';

import { Clock3, Sparkles } from 'lucide-react';
import { useNow } from '@/lib/hooks/useNow';
import { formatCountdown, msUntilNextIstMidnight } from '@/lib/time/ist';

/** Live countdown to the next daily challenge (00:00 IST). */
export function Countdown() {
  const now = useNow();
  const text = now === null ? '--:--:--' : formatCountdown(msUntilNextIstMidnight(now));

  return (
    <div className="countdown-card">
      <div className="countdown-label"><Clock3 size={14} aria-hidden="true" /> NEXT CHALLENGE IN</div>
      {/* Not a live region: announcing every second would be noisy. */}
      <div className="countdown-time" role="timer" aria-label={`Next challenge at midnight India time, in ${text}`}>{text}</div>
      <div className="countdown-foot">A new movie, every day <Sparkles size={13} aria-hidden="true" /></div>
    </div>
  );
}
