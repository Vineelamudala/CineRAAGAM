'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useStoredValue } from '@/lib/hooks/useStoredValue';
import { NameModal } from './NameModal';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const NAME_KEY = 'cineraagam:displayName';
const noopSubscribe = () => () => {};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 620px)');
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [name, setName] = useStoredValue(NAME_KEY);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameDismissed, setNameDismissed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const openMenuRef = useRef<HTMLButtonElement>(null);

  // Ask for a display name on first visit; "Maybe later" hides it for this visit.
  const nameModalOpen = editingName || (hydrated && !name && !nameDismissed);

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
      <Sidebar
        pathname={pathname}
        open={menuOpen}
        // Off-canvas on mobile: hide from keyboard and screen readers while closed.
        inert={isMobile && !menuOpen}
        onNavigate={() => setMenuOpen(false)}
        onClose={() => setMenuOpen(false)}
        closeRef={closeMenuRef}
        playerName={name}
      />
      {isMobile && menuOpen && (
        <button className="sidebar-backdrop" aria-label="Close menu" tabIndex={-1} onClick={() => setMenuOpen(false)} />
      )}

      <div className="main-area" inert={isMobile && menuOpen}>
        <Topbar pathname={pathname} onOpenMenu={() => setMenuOpen(true)} onOpenProfile={() => setEditingName(true)} menuRef={openMenuRef} />
        <main id="main">{children}</main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} CINERAAGAM</span>
          <span>MADE FOR THE LOVE OF TELUGU CINEMA <span className="footer-heart" aria-hidden="true">♥</span></span>
        </footer>
      </div>

      {nameModalOpen && (
        <NameModal
          initialName={name ?? ''}
          onSave={value => { setName(value); setEditingName(false); }}
          onClose={() => { setNameDismissed(true); setEditingName(false); }}
        />
      )}
    </div>
  );
}
