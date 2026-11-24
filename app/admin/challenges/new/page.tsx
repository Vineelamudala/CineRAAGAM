'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { PageHeader } from '@/components/admin/ui';

function NewChallenge() {
  const date = useSearchParams().get('date');
  const valid = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  return <ChallengeForm initialDate={valid} />;
}

export default function NewChallengePage() {
  return (
    <>
      <PageHeader title="Schedule a day" actions={<Link href="/admin/challenges" className="text-[12px] text-muted">← Schedule</Link>} />
      <Suspense fallback={null}><NewChallenge /></Suspense>
    </>
  );
}
