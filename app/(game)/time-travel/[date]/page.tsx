import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DailyGame } from '@/components/game/DailyGame';

export const metadata: Metadata = { title: 'Time Travel' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TimeTravelDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) notFound();

  return (
    <div className="py-10">
      <Link href="/time-travel" className="mb-5 inline-block text-[11px] tracking-[0.15em] text-muted no-underline hover:text-text">← BACK TO THE ARCHIVE</Link>
      <div className="max-w-[900px]">
        <DailyGame date={date} />
      </div>
    </div>
  );
}
