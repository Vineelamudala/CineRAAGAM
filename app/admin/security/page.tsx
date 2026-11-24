'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, Field, Input, Notice, PageHeader } from '@/components/admin/ui';
import { useAdmin, useAdminDb } from '@/lib/admin/AdminProvider';

type Enrolment = { factorId: string; qr: string; secret: string };

/** Set up or remove 2-step verification (authenticator app, TOTP) for this admin. */
export default function AdminSecurityPage() {
  const db = useAdminDb();
  const admin = useAdmin();
  const [verifiedId, setVerifiedId] = useState<string | null | undefined>(undefined);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.auth.mfa.listFactors();
    setVerifiedId(data?.totp.find(f => f.status === 'verified')?.id ?? null);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    db.auth.mfa.listFactors().then(({ data }) => {
      if (!cancelled) setVerifiedId(data?.totp.find(f => f.status === 'verified')?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [db]);

  async function startEnrolment() {
    setMsg(null);
    // Clear any half-finished enrolment first.
    const { data: existing } = await db.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status !== 'verified') await db.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Cineraagam admin ${new Date().toISOString().slice(0, 10)}` });
    if (error || !data) { setMsg({ tone: 'bad', text: error?.message ?? 'Could not start set-up.' }); return; }
    setEnrolment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnrolment(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolment) return;
    const { error } = await db.auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code: code.trim() });
    if (error) { setMsg({ tone: 'bad', text: 'That code didn’t work. Wait for a fresh code and try again.' }); return; }
    setEnrolment(null);
    setCode('');
    setMsg({ tone: 'good', text: '2-step verification is on. You’ll be asked for a code each time you sign in.' });
    await load();
    await admin.refresh();
  }

  async function disable() {
    if (!verifiedId || !confirm('Turn off 2-step verification? Your account will be protected by the password only.')) return;
    const { error } = await db.auth.mfa.unenroll({ factorId: verifiedId });
    if (error) { setMsg({ tone: 'bad', text: error.message }); return; }
    await db.auth.refreshSession();
    setMsg({ tone: 'good', text: '2-step verification is off.' });
    await load();
    await admin.refresh();
  }

  return (
    <>
      <PageHeader title="Security" description={`Signed in as ${admin.email}.`} />
      {msg && <div className="mb-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      <Card
        title="2-step verification"
        actions={verifiedId === undefined ? null : verifiedId ? <Badge tone="good">On</Badge> : <Badge tone="warn">Off</Badge>}
      >
        {verifiedId === undefined ? <p className="m-0 text-[12px] text-muted">Loading…</p> : verifiedId ? (
          <div className="grid gap-3">
            <p className="m-0 flex items-center gap-2 text-[13px]"><ShieldCheck size={16} className="text-success" /> Your account asks for an authenticator code at every sign-in.</p>
            <p className="m-0 text-[12px] text-muted">Lost your phone? The site operator can reset it with <code>node scripts/admin.mjs reset-2fa &lt;email&gt;</code>.</p>
            <div><Button variant="danger" onClick={disable}>Turn off</Button></div>
          </div>
        ) : enrolment ? (
          <form onSubmit={confirmEnrolment} className="grid gap-4 md:grid-cols-[220px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code is an inline SVG data URL */}
            <img src={enrolment.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-xl bg-white p-2" />
            <div className="grid content-start gap-3">
              <p className="m-0 text-[13px]">Scan the QR code with any authenticator app (Google Authenticator, Microsoft Authenticator, Aegis, 1Password…), then enter the 6-digit code it shows.</p>
              <p className="m-0 text-[11px] text-muted">Can’t scan? Enter this key manually: <code className="break-all">{enrolment.secret}</code></p>
              <Field label="6-digit code" htmlFor="mfa-code">
                <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="max-w-[180px] font-mono tracking-[0.4em]" />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" disabled={code.length !== 6}>Turn on</Button>
                <Button variant="ghost" onClick={() => setEnrolment(null)}>Cancel</Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="grid gap-3">
            <p className="m-0 text-[13px]">Protect the admin account with a code from an authenticator app, so a stolen password alone is not enough.</p>
            <div><Button variant="primary" onClick={startEnrolment}>Set up 2-step verification</Button></div>
          </div>
        )}
      </Card>
    </>
  );
}
