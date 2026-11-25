import Link from 'next/link';
import { AudioLines, Flame, UserRound, X } from 'lucide-react';
import type { Ref } from 'react';
import { InstallButton } from '@/components/pwa/InstallButton';
import { SidebarWeek } from '@/components/WeekStrip';
import type { MyStats } from '@/lib/game/api';
import { NAV_ITEMS, isActiveNav } from '@/lib/nav';

type Props = {
  pathname: string;
  open: boolean;
  inert: boolean;
  onNavigate: () => void;
  onClose: () => void;
  closeRef: Ref<HTMLButtonElement>;
  playerName: string | null;
  stats: MyStats | null;
};

export function Sidebar({ pathname, open, inert, onNavigate, onClose, closeRef, playerName, stats }: Props) {
  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} inert={inert}>
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><AudioLines size={22} /></div>
        <div>
          <div className="brand-name">cine<span>raagam</span></div>
          <div className="brand-tag">TELUGU MUSIC, DAILY</div>
        </div>
        <button ref={closeRef} className="mobile-close icon-button" onClick={onClose} aria-label="Close menu"><X size={19} /></button>
      </div>

      <div className="side-label">PLAY</div>
      <nav className="nav-list" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActiveNav(href, pathname);
          return (
            <Link key={href} href={href} onClick={onNavigate} className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <InstallButton />
        <div className="streak-card">
          <div className="streak-top"><span className="streak-icon"><Flame size={17} aria-hidden="true" /></span><span>YOUR STREAK</span></div>
          <div className="streak-number">{stats ? String(stats.current_streak).padStart(2, '0') : '––'} <small>{stats?.current_streak === 1 ? 'day' : 'days'}</small></div>
          <div className="streak-note">
            {!stats ? 'Loading…' : stats.current_streak > 0 ? 'Keep the rhythm going.' : stats.best_streak > 0 ? `Best so far: ${stats.best_streak}. Start a new run today.` : 'Solve today’s movie to start a streak.'}
          </div>
          <SidebarWeek week={stats?.week} />
        </div>
        <div className="profile-row">
          <div className="avatar" aria-hidden="true"><UserRound size={17} /></div>
          <div className="profile-copy">
            <strong>{playerName || 'Guest Player'}</strong>
            <span>Anonymous player</span>
          </div>
          <span className="online-dot" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}
