import { redirect } from 'next/navigation';

/** History now lives on the Statistics page ("all stats in one place"). */
export default function HistoryPage() {
  redirect('/stats#history');
}
