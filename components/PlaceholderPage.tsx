import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

type Props = {
  title: string;
  copy: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyText: string;
};

/** Shell for sections that are connected to real data in later phases. */
export function PlaceholderPage({ title, copy, icon: Icon, emptyTitle, emptyText }: Props) {
  return (
    <section className="placeholder-page">
      <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> CINERAAGAM</div>
      <h1>{title}</h1>
      <p className="welcome-copy">{copy}</p>
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true"><Icon /></div>
        <h2 className="text-[20px] font-display tracking-[-0.04em] m-0 mb-2 font-bold">{emptyTitle}</h2>
        <p>{emptyText}</p>
        <Link className="submit-button" href="/">BACK TO TODAY <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );
}
