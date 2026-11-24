import { AppShell } from '@/components/shell/AppShell';
import { PlayerProvider } from '@/lib/player/PlayerProvider';
import { StatsProvider } from '@/lib/player/StatsProvider';

/** Player-facing pages: silent anonymous identity, live stats and the game shell. */
export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PlayerProvider>
      <StatsProvider>
        <AppShell>{children}</AppShell>
      </StatsProvider>
    </PlayerProvider>
  );
}
