import { CalendarDays, ChartNoAxesCombined, CircleHelp, History, Home, Trophy, type LucideIcon } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Today', icon: Home },
  { href: '/time-travel', label: 'Time Travel', icon: CalendarDays },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/stats', label: 'Statistics', icon: ChartNoAxesCombined },
  { href: '/history', label: 'My History', icon: History },
  { href: '/how-to-play', label: 'How to Play', icon: CircleHelp },
];

/** True when `pathname` is the nav item's page or one of its sub-pages. */
export function isActiveNav(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function navLabelFor(pathname: string): string {
  return NAV_ITEMS.find(i => isActiveNav(i.href, pathname))?.label ?? 'Today';
}
