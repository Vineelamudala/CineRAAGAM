'use client';

import { use } from 'react';
import Link from 'next/link';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { PageHeader } from '@/components/admin/ui';

export default function EditChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = use(params);
  const { created } = use(searchParams);
  return (
    <>
      <PageHeader title="Edit challenge" actions={<Link href="/admin/challenges" className="text-[12px] text-muted">← Schedule</Link>} />
      <ChallengeForm challengeId={id} justCreated={created === '1'} />
    </>
  );
}
