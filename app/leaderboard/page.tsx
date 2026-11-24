import type { Metadata } from 'next';
import { Trophy } from 'lucide-react';
import { PlaceholderPage } from '@/components/PlaceholderPage';

export const metadata: Metadata = { title: 'Leaderboard' };

export default function LeaderboardPage() {
  return (
    <PlaceholderPage
      icon={Trophy}
      title="The leaderboard"
      copy="Weekly, monthly and all-time rankings by points from official daily challenges. Ties go to the player with more days solved, then whoever got there first."
      emptyTitle="The rankings are warming up"
      emptyText="This section will be connected when we add the database and real daily challenges."
    />
  );
}
