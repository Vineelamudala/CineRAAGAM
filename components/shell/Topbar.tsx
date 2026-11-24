import { Flame, Menu, UserRound } from 'lucide-react';
import type { Ref } from 'react';
import { DEMO_STATS } from '@/lib/demo';
import { navLabelFor } from '@/lib/nav';

type Props = {
  pathname: string;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  menuRef: Ref<HTMLButtonElement>;
};

export function Topbar({ pathname, onOpenMenu, onOpenProfile, menuRef }: Props) {
  return (
    <header className="topbar">
      <button ref={menuRef} className="mobile-menu icon-button" onClick={onOpenMenu} aria-label="Open menu"><Menu size={21} /></button>
      <div className="breadcrumb">PLAY <span aria-hidden="true">/</span> <strong>{navLabelFor(pathname).toUpperCase()}</strong></div>
      <div className="top-actions">
        <div className="top-streak" aria-label={`${DEMO_STATS.streak} day streak`}>
          <Flame size={16} aria-hidden="true" /><strong>{DEMO_STATS.streak}</strong><span>day streak</span>
        </div>
        <button className="icon-button" aria-label="Edit display name" onClick={onOpenProfile}><UserRound size={19} /></button>
      </div>
    </header>
  );
}
