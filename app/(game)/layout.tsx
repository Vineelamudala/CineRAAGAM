import { AppShell } from '@/components/shell/AppShell';
import { PlayerProvider } from '@/lib/player/PlayerProvider';

/** Player-facing pages: silent anonymous identity + the game shell. */
export default function GameLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PlayerProvider>
      <AppShell>{children}</AppShell>
    </PlayerProvider>
  );
}
