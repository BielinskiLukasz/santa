import { useState } from 'react';
import type { FormEvent } from 'react';
import { CircleHelp, KeyRound, LockKeyhole, Mail, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import { pl } from '../i18n/pl';
import { StorageError } from '../storage';
import { errorText } from './controller';
import { DangerButton, Field, MotionToggle, PrimaryButton, inputClass } from './widgets';

export function LockedScreen({
  hasSaved,
  busy,
  muted,
  onToggleMute,
  onSetup,
  onUnlock,
  onResetAll,
  onHelp,
  showNotice,
}: {
  hasSaved: boolean;
  busy: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onSetup: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<void>;
  onResetAll: () => void;
  onHelp: () => void;
  showNotice: (kind: 'info' | 'error', text: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');

  const submitSetup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (Array.from(password).length < 8) {
      setError(pl.locked.passwordTooShort);
      return;
    }
    if (password !== repeat) {
      setError(pl.locked.passwordMismatch);
      return;
    }
    try {
      await onSetup(password);
    } catch (cause) {
      setError(
        cause instanceof StorageError && cause.code === 'CRYPTO_UNAVAILABLE'
          ? pl.locked.cryptoUnavailable
          : errorText(cause),
      );
    }
  };

  const submitUnlock = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await onUnlock(password);
    } catch (cause) {
      setError(
        cause instanceof StorageError && cause.code === 'CRYPTO_UNAVAILABLE'
          ? pl.locked.cryptoUnavailable
          : cause instanceof StorageError && cause.code === 'AUTH_FAILED'
            ? pl.locked.unlockFailed
            : errorText(cause),
      );
    }
  };

  const submitReset = () => {
    onResetAll();
    setResetOpen(false);
    setResetText('');
    setPassword('');
    showNotice('info', pl.locked.resetDone);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-night text-cream">
      <button
        type="button"
        onClick={onHelp}
        aria-label={pl.event.helpButton}
        title={pl.event.helpButton}
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-cream/40 transition hover:bg-cream/10"
      >
        <CircleHelp size={18} aria-hidden="true" />
      </button>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="star absolute left-[12%] top-[16%] h-1.5 w-1.5 rounded-full bg-cream" />
        <span className="star absolute left-[78%] top-[10%] h-1 w-1 rounded-full bg-cream" style={{ animationDelay: '-1.5s' }} />
        <span className="star absolute left-[64%] top-[26%] h-1.5 w-1.5 rounded-full bg-gold" style={{ animationDelay: '-3s' }} />
        <span className="star absolute left-[28%] top-[34%] h-1 w-1 rounded-full bg-cream" style={{ animationDelay: '-2s' }} />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-pine to-transparent" />
      </div>

      <main className="relative grid flex-1 place-items-center px-4 py-10">
        <div className="w-full max-w-md animate-fade-up rounded-3xl bg-paper p-7 text-ink shadow-2xl sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-forest/40 text-forest">
              <Mail size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-xl font-semibold leading-none">{pl.appName}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-mist">{pl.event.tagline}</p>
            </div>
          </div>

          {hasSaved ? (
            <form onSubmit={submitUnlock} className="mt-7">
              <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
                <LockKeyhole size={26} aria-hidden="true" /> {pl.locked.unlockTitle}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-mist">{pl.locked.unlockIntro}</p>
              <div className="mt-5">
                <Field label={pl.common.operatorPassword}>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={inputClass}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                  />
                </Field>
              </div>
              {error ? <p role="alert" className="mt-3 text-sm font-semibold text-seal">{error}</p> : null}
              <div className="mt-6">
                <PrimaryButton type="submit" busy={busy} disabled={password.length === 0}>
                  {busy ? pl.locked.unlockBusy : pl.locked.unlockSubmit}
                </PrimaryButton>
              </div>
            </form>
          ) : (
            <form onSubmit={submitSetup} className="mt-7">
              <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
                <KeyRound size={26} aria-hidden="true" /> {pl.locked.firstRunTitle}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-mist">{pl.locked.firstRunIntro}</p>
              <p className="mt-3 flex gap-2 rounded-2xl bg-gold/20 p-3 text-sm leading-relaxed text-ink">
                <ShieldAlert className="mt-0.5 shrink-0 text-clay" size={18} aria-hidden="true" />
                {pl.locked.firstRunWarning}
              </p>
              <div className="mt-5 grid gap-4">
                <Field label={pl.locked.passwordLabel}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputClass}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={busy}
                  />
                </Field>
                <Field label={pl.locked.repeatLabel}>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputClass}
                    value={repeat}
                    onChange={(event) => setRepeat(event.target.value)}
                    disabled={busy}
                  />
                </Field>
              </div>
              {error ? <p role="alert" className="mt-3 text-sm font-semibold text-seal">{error}</p> : null}
              <div className="mt-6">
                <PrimaryButton type="submit" busy={busy} disabled={password.length === 0 || repeat.length === 0}>
                  {busy ? pl.locked.setupBusy : pl.locked.setupSubmit}
                </PrimaryButton>
              </div>
            </form>
          )}

          {hasSaved ? (
            <div className="mt-7 border-t border-forest/15 pt-5">
              {resetOpen ? (
                <div className="grid gap-3">
                  <p className="flex gap-2 text-sm leading-relaxed text-seal">
                    <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
                    {pl.locked.resetWarning}
                  </p>
                  <Field label={pl.locked.resetConfirmLabel}>
                    <input
                      className={inputClass}
                      value={resetText}
                      onChange={(event) => setResetText(event.target.value)}
                      placeholder="RESET"
                      autoComplete="off"
                    />
                  </Field>
                  <div>
                    <DangerButton disabled={resetText !== 'RESET'} onClick={submitReset}>
                      {pl.locked.resetSubmit}
                    </DangerButton>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-sm font-semibold text-seal underline-offset-4 hover:underline"
                  onClick={() => setResetOpen(true)}
                >
                  {pl.locked.forgotPassword}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </main>

      <footer className="relative flex items-center justify-between px-5 pb-6 text-cream">
        <MotionToggle />
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? pl.common.unmute : pl.common.mute}
          aria-pressed={muted}
          title={muted ? pl.common.unmute : pl.common.mute}
          className="grid h-10 w-10 place-items-center rounded-full border border-cream/40 transition hover:bg-cream/10"
        >
          {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
      </footer>
    </div>
  );
}
