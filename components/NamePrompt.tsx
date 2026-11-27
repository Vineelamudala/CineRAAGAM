'use client';

import { Trophy } from 'lucide-react';
import { usePlayer } from '@/lib/player/PlayerProvider';

/**
 * Invites players without a display name to add one, so they appear on the
 * leaderboard. Renders nothing for named players.
 */
export function NamePrompt({ text = 'Add your display name to appear on the leaderboard. Your points so far will count too.' }: { text?: string }) {
  const player = usePlayer();
  if (player.status !== 'ready' || player.displayName) return null;
  return (
    <div className="name-prompt">
      <span className="name-prompt-icon" aria-hidden="true"><Trophy size={16} /></span>
      <span className="name-prompt-text">{text}</span>
      <button type="button" className="name-prompt-button" onClick={player.openNameEditor}>Add my name</button>
    </div>
  );
}
