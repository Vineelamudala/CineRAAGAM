'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { usePlayer } from '@/lib/player/PlayerProvider';
import { useStats } from '@/lib/player/StatsProvider';
import { NameModal } from './NameModal';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const DISMISS_KEY = 'cineraagam:name-dismissed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 620px)');
  const player = usePlayer();
  const { stats } = useStats();
  const [menuOpen, setMenuOpen] = useState(false);
  // "Maybe later" lasts for the browser session (the dialog only renders on the
  // client after the session loads, so this doesn't affect server rendering).
  const [nameDismissed, setNameDismissed] = useState(() => {
    try { return typeof window !== 'undefined' && window.sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [editingName, setEditingName] = useState(false);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const openMenuRef = useRef<HTMLButtonElement>(null);

  // Ask for a display name once the anonymous session is ready and the player
  // has none yet; "Maybe later" hides it for this visit.
  const ready = player.status === 'ready';
  const nameModalOpen = ready && (editingName || (!player.displayName && !nameDismissed));

  // Move focus into the mobile menu when it opens, and back when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!isMobile) return;
    if (menuOpen) closeMenuRef.current?.focus();
    else if (wasOpen.current) openMenuRef.current?.focus();
    wasOpen.current = menuOpen;
  }, [menuOpen, isMobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to main content</a>
      <Sidebar
        pathname={pathname}
        open={menuOpen}
        // Off-canvas on mobile: hide from keyboard and screen readers while closed.
        inert={isMobile && !menuOpen}
        onNavigate={() => setMenuOpen(false)}
        onClose={() => setMenuOpen(false)}
        closeRef={closeMenuRef}
        playerName={player.displayName}
        stats={stats}
      />
      {isMobile && menuOpen && (
        <button className="sidebar-backdrop" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} />
      )}

      <div className="main-area" inert={isMobile && menuOpen}>
        <Topbar pathname={pathname} streak={stats?.current_streak ?? null} onOpenMenu={() => setMenuOpen(true)} onOpenProfile={() => setEditingName(true)} menuRef={openMenuRef} />
        {player.status === 'error' && (
          <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#4a2a33] bg-[#1a0f13] px-4 py-3 text-[12px] text-[#f2c4cb]">
            <span>We couldn’t connect to the Cineraagam server. Your progress won’t be saved until we reconnect.</span>
            <button onClick={player.retry} className="shrink-0 cursor-pointer rounded-lg border border-[#6b3a46] bg-transparent px-3 py-1.5 text-[11px] font-semibold text-[#ffd9de]">Retry</button>
          </div>
        )}
        <main id="main" tabIndex={-1} className="outline-none">{children}</main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} CINERAAGAM</span>
          <span>MADE FOR THE LOVE OF TELUGU CINEMA <span className="footer-heart" aria-hidden="true">♥</span></span>
        </footer>
      </div>

      {nameModalOpen && (
        <NameModal
          initialName={player.displayName ?? ''}
          onSave={async value => {
            const error = await player.saveDisplayName(value);
            if (!error) setEditingName(false);
            return error;
          }}
          onClose={() => {
            setNameDismissed(true);
            setEditingName(false);
            try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked: dismiss for this page only */ }
          }}
        />
      )}
    </div>
  );
}
