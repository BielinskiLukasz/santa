import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { KeyRound, Loader2, X } from 'lucide-react';
import { pl } from '../i18n/pl';
import { AnimalAvatar } from '../scene/animals';

export function MotionToggle() {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('motion-off', paused);
    return () => document.documentElement.classList.remove('motion-off');
  }, [paused]);

  return (
    <button
      type="button"
      className="border-b border-current pb-0.5 text-xs opacity-80 transition hover:opacity-100 disabled:cursor-default disabled:opacity-60"
      disabled={reduced}
      aria-pressed={paused || reduced}
      onClick={() => setPaused((value) => !value)}
    >
      {reduced ? pl.common.motionReduced : paused ? pl.common.motionStart : pl.common.motionStop}
    </button>
  );
}

export function AnimalDisc({ animalId, size = 40 }: { animalId: string; size?: number }) {
  return <AnimalAvatar kind={animalId} size={size} />;
}

export function PrimaryButton({
  children,
  busy,
  disabled,
  onClick,
  type,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-cream transition hover:bg-pine disabled:opacity-50"
    >
      {busy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  disabled,
  onClick,
  type,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-forest/30 px-5 text-sm font-bold text-forest transition hover:border-forest/60 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  busy,
  disabled,
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-seal px-5 text-sm font-bold text-cream transition hover:brightness-110 disabled:opacity-50"
    >
      {busy ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-parchment p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {hint ? <p className="mt-1 text-sm leading-relaxed text-mist">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-xl border border-forest/25 bg-white px-3 text-sm text-ink placeholder:text-mist/70 focus:border-forest/60 focus:outline-none disabled:opacity-50';

export function PasswordGate({
  busy,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  onSubmit: (password: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const ok = await onSubmit(password);
    if (!ok) setError(pl.gate.wrongPassword);
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-night/70 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="w-full max-w-md rounded-3xl bg-paper p-6 shadow-2xl animate-fade-up"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="gate-title" className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
            <KeyRound size={22} aria-hidden="true" /> {pl.gate.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={pl.common.close}
            className="rounded-full p-1 text-ink/70 transition hover:bg-forest/10"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-mist">{pl.gate.intro}</p>
        <div className="mt-4">
          <Field label={pl.common.operatorPassword}>
            <input
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-seal">{error}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <GhostButton onClick={onClose}>{pl.common.cancel}</GhostButton>
          <PrimaryButton type="submit" busy={busy} disabled={password.length === 0}>
            {pl.gate.submit}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
