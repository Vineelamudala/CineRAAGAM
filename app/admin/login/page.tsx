'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AudioLines, Loader2 } from 'lucide-react';
import { Button, Field, Input, Notice } from '@/components/admin/ui';
import { evaluateAdmin, useAdmin } from '@/lib/admin/AdminProvider';

/**
 * Admin sign-in: e-mail + password, then the authenticator code if 2-step
 * verification is enabled. Players never see or need this page.
 */
export default function AdminLoginPage() {
  const admin = useAdmin();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = admin.supabase;
  const step = admin.status === 'needs-mfa' ? 'mfa' : 'password';

  useEffect(() => {
    if (admin.status === 'ready') router.replace('/admin');
  }, [admin.status, router]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setBusy(false);
      setError('Incorrect e-mail or password.');
      return;
    }
    const result = await evaluateAdmin(supabase);
    if (result.status === 'not-admin') {
      await supabase.auth.signOut();
      setError('This account does not have admin access.');
    }
    await admin.refresh();
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp.find(f => f.status === 'verified');
    if (listError || !totp) {
      setBusy(false);
      setError('Could not load your authenticator. Ask the operator to reset 2-step verification.');
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError('That code didn’t work. Check your authenticator app and try again.');
      return;
    }
    await admin.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-5 text-text">
      <div className="w-full max-w-[380px] rounded-2xl border border-line bg-panel p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="brand-mark h-10! w-10! rounded-xl!" aria-hidden="true"><AudioLines size={18} /></span>
          <div>
            <h1 className="m-0 text-[18px] font-extrabold tracking-[-0.03em]">Cineraagam admin</h1>
            <p className="m-0 text-[11px] text-muted">For the people who run the show.</p>
          </div>
        </div>

        {admin.status === 'loading' && <Loader2 className="animate-spin text-muted" aria-label="Loading" />}
        {admin.status === 'unconfigured' && <Notice tone="bad">Supabase is not configured for this site.</Notice>}

        {admin.status === 'player' && (
          <div className="mb-4">
            <Notice tone="warn">
              This browser is currently a <strong>player</strong>. Signing in as admin replaces this browser’s
              anonymous player profile. Tip: use a separate browser profile for admin work.
            </Notice>
          </div>
        )}

        {step === 'password' && admin.status !== 'loading' && admin.status !== 'unconfigured' && (
          <form onSubmit={signIn} className="grid gap-4">
            <Field label="E-mail" htmlFor="admin-email">
              <Input id="admin-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" htmlFor="admin-password">
              <Input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            </Field>
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
            <p className="m-0 text-[11px] leading-relaxed text-muted">
              Admin accounts are created by the site operator (<code>node scripts/admin.mjs create</code>). There is no public sign-up.
            </p>
          </form>
        )}

        {step === 'mfa' && (
          <form onSubmit={verify} className="grid gap-4">
            <p className="m-0 text-[13px] text-muted">Enter the 6-digit code from your authenticator app.</p>
            <Field label="Authenticator code" htmlFor="admin-code">
              <Input
                id="admin-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="font-mono tracking-[0.4em]"
              />
            </Field>
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="submit" variant="primary" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify'}</Button>
            <Button variant="ghost" onClick={() => admin.signOut()}>Use a different account</Button>
          </form>
        )}
      </div>
    </div>
  );
}
