'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AudioLines, CalendarRange, Film, LayoutDashboard, ListChecks, Loader2, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAdmin } from '@/lib/admin/AdminProvider';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/challenges', label: 'Schedule', icon: CalendarRange },
  { href: '/admin/movies', label: 'Movies & clips', icon: Film },
  { href: '/admin/plays', label: 'Who played', icon: ListChecks },
  { href: '/admin/players', label: 'Players', icon: Users },
  { href: '/admin/security', label: 'Security', icon: ShieldCheck },
];

/** Guards every /admin page except the login page, and renders the admin chrome. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAdmin();
  const isLogin = pathname === '/admin/login';
  const mustLogin = !isLogin && admin.status !== 'loading' && admin.status !== 'ready';

  useEffect(() => {
    if (mustLogin) router.replace('/admin/login');
  }, [mustLogin, router]);

  if (isLogin) return <>{children}</>;
  if (admin.status !== 'ready') {
    return (
      <div className="grid min-h-screen place-items-center text-muted" aria-busy="true">
        <Loader2 className="animate-spin" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link href="/admin" className="flex items-center gap-2.5 text-text no-underline">
            <span className="brand-mark h-8! w-8! rounded-[10px]!" aria-hidden="true"><AudioLines size={16} /></span>
            <span className="text-[15px] font-extrabold tracking-[-0.04em]">cineraagam <span className="font-mono text-[10px] font-normal tracking-[0.2em] text-muted">ADMIN</span></span>
          </Link>
          <nav aria-label="Admin" className="flex flex-1 flex-wrap gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] no-underline ${active ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'}`}
                >
                  <Icon size={14} aria-hidden="true" /> {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="hidden sm:inline">{admin.email}</span>
            <button
              onClick={async () => { await admin.signOut(); router.replace('/admin/login'); }}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-transparent px-2.5 py-1.5 text-[11px] text-muted hover:text-text"
            >
              <LogOut size={13} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-5 py-8">{children}</main>
    </div>
  );
}
