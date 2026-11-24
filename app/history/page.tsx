import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export const metadata: Metadata = { title: 'My History' };

export default function HistoryPage() {
  return (
    <PlaceholderPage
      icon={History}
      title="Your game history"
      copy="Every daily challenge you have played: the movie, how many clues you needed and the points you earned. Missed days can be played in Time Travel."
      emptyTitle="Your history will appear here"
      emptyText="This section will be connected when we add the database and real daily challenges."
    />
  );
}
