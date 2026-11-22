import { useEffect } from 'react';
import { Info, TriangleAlert, X } from 'lucide-react';
import { pl } from '../i18n/pl';
import { AdminZone } from './AdminZone';
import { useEventController } from './controller';
import { EventScreen } from './EventScreen';
import { LockedScreen } from './LockedScreen';
import { PasswordGate } from './widgets';

export default function App() {
  const controller = useEventController();
  const {
    screen,
    hasSaved,
    state,
    stateEpoch,
    busy,
    notice,
    adminOpen,
    gateOpen,
    showNotice,
    clearNotice,
    setupPassword,
    unlock,
    lockApp,
    dispatch,
    undoLastDraw,
    resetDrawing,
    exportBackup,
    importBackup,
    resetAll,
    requestAdmin,
    submitGate,
    closeGate,
    closeAdmin,
  } = controller;

  // UI-SPEC §7: Ctrl+Shift+A opens the admin gate.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        requestAdmin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestAdmin]);

  if (screen === 'booting' || (screen === 'app' && state === null)) {
    return (
      <div className="grid min-h-screen place-items-center bg-night text-cream">
        <p className="font-display text-2xl">{pl.appName}…</p>
      </div>
    );
  }

  return (
    <>
      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-4 z-50 flex w-[min(92vw,34rem)] -translate-x-1/2 items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl ${
            notice.kind === 'error' ? 'bg-seal text-cream' : 'bg-cream text-ink'
          }`}
        >
          {notice.kind === 'error' ? (
            <TriangleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          )}
          <p className="text-sm font-semibold leading-relaxed">{notice.text}</p>
          <button
            type="button"
            onClick={clearNotice}
            aria-label={pl.common.close}
            className="ml-auto rounded-full p-1 transition hover:bg-black/10"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {screen === 'locked' ? (
        <LockedScreen
          hasSaved={hasSaved}
          busy={busy}
          onSetup={setupPassword}
          onUnlock={unlock}
          onResetAll={resetAll}
          showNotice={showNotice}
        />
      ) : state ? (
        <>
          <EventScreen
            state={state}
            busy={busy}
            onOpenAdmin={requestAdmin}
            onDispatch={dispatch}
            onLock={lockApp}
          />
          {adminOpen ? (
            <AdminZone
              key={stateEpoch}
              state={state}
              busy={busy}
              onClose={closeAdmin}
              onDispatch={dispatch}
              onUndo={undoLastDraw}
              onResetDrawing={resetDrawing}
              onExport={exportBackup}
              onImport={importBackup}
              onResetAll={resetAll}
              showNotice={showNotice}
            />
          ) : null}
          {gateOpen ? (
            <PasswordGate busy={busy} onSubmit={submitGate} onClose={closeGate} />
          ) : null}
        </>
      ) : null}
    </>
  );
}
