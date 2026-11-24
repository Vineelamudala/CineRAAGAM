import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export const metadata: Metadata = { title: 'Time Travel' };

export default function TimeTravelPage() {
  return (
    <PlaceholderPage
      icon={CalendarDays}
      title="The soundtrack archive"
      copy="Play any previous daily challenge. Time Travel games show the points you would have earned, but never count towards leaderboards or streaks."
      emptyTitle="Your past challenges will appear here"
      emptyText="This section will be connected when we add the database and real daily challenges."
    />
  );
}
