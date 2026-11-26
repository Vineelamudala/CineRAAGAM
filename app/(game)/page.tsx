import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, CircleHelp, ListMusic, Trophy } from 'lucide-react';
import { Countdown } from '@/components/Countdown';
import { DailyGame } from '@/components/game/DailyGame';
import { RightRail } from '@/components/RightRail';

// The home page is the one main address search engines should show.
export const metadata: Metadata = { alternates: { canonical: '/' } };

const MORE_WAYS = [
  { href: '/time-travel', icon: CalendarDays, title: 'Time Travel', text: 'Revisit past challenges' },
  { href: '/leaderboard', icon: Trophy, title: 'Leaderboard', text: 'See how you rank' },
  { href: '/how-to-play', icon: CircleHelp, title: 'How to play', text: 'Learn the rules' },
];

export default function TodayPage() {
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" aria-hidden="true" /> THE DAILY TELUGU MUSIC CHALLENGE</div>
          <h1>Hear it. <em>Feel it.</em><br />Name that movie.</h1>
          <p className="welcome-copy">Three music clues. One Telugu movie. How well do you know your cinema?</p>
        </div>
        <Countdown />
      </section>

      <div className="game-layout">
        <DailyGame />
        <RightRail />
      </div>

      <nav className="bottom-strip" aria-label="More ways to play">
        <div className="bottom-strip-title"><ListMusic size={16} aria-hidden="true" /> MORE WAYS TO PLAY</div>
        {MORE_WAYS.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href}>
            <Icon size={17} aria-hidden="true" />
            <span><strong>{title}</strong><small>{text}</small></span>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </nav>
    </>
  );
}
