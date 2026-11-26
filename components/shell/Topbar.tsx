import { ChartNoAxesColumn, Flame, Menu, UserRound } from 'lucide-react';
import type { Ref } from 'react';
import { navLabelFor } from '@/lib/nav';

type Props = {
  pathname: string;
  streak: number | null;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onOpenStats: () => void;
  menuRef: Ref<HTMLButtonElement>;
};

export function Topbar({ pathname, streak, onOpenMenu, onOpenProfile, onOpenStats, menuRef }: Props) {
  return (
    <header className="topbar">
      <button ref={menuRef} className="mobile-menu icon-button" onClick={onOpenMenu} aria-label="Open menu"><Menu size={21} /></button>
      <div className="breadcrumb">PLAY <span aria-hidden="true">/</span> <strong>{navLabelFor(pathname).toUpperCase()}</strong></div>
      <div className="top-actions">
        {streak !== null && (
          <div className="top-streak" aria-label={`${streak} day streak`}>
            <Flame size={16} aria-hidden="true" /><strong>{streak}</strong><span>day streak</span>
          </div>
        )}
        <button className="icon-button" aria-label="Open statistics" onClick={onOpenStats}><ChartNoAxesColumn size={19} /></button>
        <button className="icon-button" aria-label="Edit display name" onClick={onOpenProfile}><UserRound size={19} /></button>
      </div>
    </header>
  );
}
