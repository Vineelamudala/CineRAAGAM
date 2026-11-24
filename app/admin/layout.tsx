import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminProvider } from '@/lib/admin/AdminProvider';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Cineraagam admin' },
  robots: { index: false, follow: false },
};

/** Admin area: separate from the player shell and never creates anonymous players. */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
