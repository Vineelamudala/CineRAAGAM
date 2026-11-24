import type { Metadata } from 'next';
import { ChartNoAxesCombined } from 'lucide-react';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export const metadata: Metadata = { title: 'Statistics' };

export default function StatsPage() {
  return (
    <PlaceholderPage
      icon={ChartNoAxesCombined}
      title="Your journey in music"
      copy="Every guess, every streak, every movie recognised."
      emptyTitle="Your stats will build as you play"
      emptyText="This section will be connected when we add the database and real daily challenges."
    />
  );
}
