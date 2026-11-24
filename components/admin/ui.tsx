// Small UI kit for the admin dashboard (Tailwind, theme tokens from globals.css).
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display m-0 text-[30px] leading-tight font-bold tracking-[-0.02em] text-text">{title}</h1>
        {description && <p className="m-0 mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-panel p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="m-0 font-mono text-[10px] font-semibold tracking-[0.22em] text-muted uppercase">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'border-transparent bg-text text-bg hover:opacity-90',
  secondary: 'border-line bg-panel-2 text-text hover:border-muted',
  danger: 'border-[#5a2a31] bg-[#1d0f12] text-[#f5b3bb] hover:border-[#8a3a46]',
  ghost: 'border-transparent bg-transparent text-muted hover:text-text',
};
const buttonBase = 'inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3.5 text-[12px] font-semibold no-underline transition disabled:cursor-not-allowed disabled:opacity-40';

export function Button({ variant = 'secondary', className, ...props }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" className={cx(buttonBase, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = 'secondary', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(buttonBase, variants[variant], className)} {...props} />;
}

const fieldBase = 'w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-[13px] text-text outline-none placeholder:text-muted focus:border-muted';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cx(fieldBase, 'h-10', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(fieldBase, 'h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(fieldBase, 'min-h-20', className)} {...props} />;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold tracking-[0.04em] text-muted">{label}</label>
      {children}
      {hint && <p className="m-0 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

const tones = {
  neutral: 'border-line text-muted',
  good: 'border-[#2f5a3d] text-success',
  warn: 'border-[#5c4a22] text-gold',
  bad: 'border-[#5a2a31] text-danger',
};
export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase', tones[tone])}>{children}</span>;
}

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'bad' | 'warn'; children: ReactNode }) {
  const t = { neutral: 'border-line text-muted', good: 'border-[#2f5a3d] text-success', bad: 'border-[#5a2a31] text-danger', warn: 'border-[#5c4a22] text-gold' }[tone];
  return <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('rounded-lg border bg-panel-2 px-3.5 py-2.5 text-[12px] leading-relaxed', t)}>{children}</div>;
}

/** Human-friendly message for common Postgres / API errors. */
export function friendlyError(err: { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'Something went wrong.';
  switch (err.code) {
    case '23505': return 'That already exists (for example, another challenge is scheduled on this date).';
    case '23503': return 'This is still in use (for example, a clip used by a challenge) — remove it from there first.';
    case '23514': return 'Some values are not allowed (check clip length, distinct clips and required fields).';
    case '42501': return 'You don’t have permission to do that. Try signing in again.';
    default: return err.message ?? 'Something went wrong.';
  }
}
