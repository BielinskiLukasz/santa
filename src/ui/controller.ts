import { useCallback, useEffect, useRef, useState } from 'react';
import { createCryptoRandom } from '../engine';
import type { Draw } from '../engine';
import { createInitialState, StateError } from '../state';
import type { AppAction, AppState } from '../state';
import { SecureEventStore, StorageError } from '../storage';
import type { StorageAdapter } from '../storage';
import { pl } from '../i18n/pl';

export const ADMIN_IDLE_MS = 5 * 60 * 1_000;

export type Screen = 'booting' | 'locked' | 'app';

export interface Notice {
  readonly kind: 'info' | 'error';
  readonly text: string;
}

export function errorText(error: unknown): string {
  if (error instanceof StorageError || error instanceof StateError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Coś poszło nie tak. Spróbuj ponownie.';
}

function memoryStorage(): StorageAdapter {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: (key) => { entries.delete(key); },
  };
}

function browserStorage(): StorageAdapter {
  try {
    const storage = window.localStorage;
    storage.setItem('__zwierzeta_probe__', '1');
    storage.removeItem('__zwierzeta_probe__');
    return storage;
  } catch {
    return memoryStorage();
  }
}

export interface EventController {
  readonly screen: Screen;
  readonly hasSaved: boolean;
  readonly state: AppState | null;
  /** Increments after every persisted change; remounts the admin draft with fresh data. */
  readonly stateEpoch: number;
  readonly busy: boolean;
  readonly notice: Notice | null;
  readonly adminOpen: boolean;
  readonly gateOpen: boolean;
  showNotice(kind: Notice['kind'], text: string): void;
  clearNotice(): void;
  setupPassword(password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  lockApp(): void;
  dispatch(action: AppAction): Promise<AppState>;
  /** Draws for one participant; the assignment is persisted before it is returned. */
  drawParticipant(giverId: string): Promise<Draw>;
  undoLastDraw(password: string): Promise<void>;
  resetDrawing(password: string): Promise<void>;
  exportBackup(password: string): Promise<string>;
  importBackup(raw: string, password: string, confirmed: boolean): Promise<void>;
  resetAll(): void;
  requestAdmin(): void;
  submitGate(password: string): Promise<boolean>;
  closeGate(): void;
  closeAdmin(): void;
}

export function useEventController(): EventController {
  const storeRef = useRef<SecureEventStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new SecureEventStore(browserStorage(), globalThis.crypto);
  }
  const store = storeRef.current;

  const [screen, setScreen] = useState<Screen>('booting');
  const [hasSaved, setHasSaved] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [stateEpoch, setStateEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const lastActivityRef = useRef(0);

  const showNotice = useCallback((kind: Notice['kind'], text: string) => {
    setNotice({ kind, text });
  }, []);
  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    setHasSaved(store.hasSavedState());
    setScreen('locked');
  }, [store]);

  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const openAdminSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    setGateOpen(false);
    setAdminOpen(true);
  }, []);

  const closeAdmin = useCallback(() => setAdminOpen(false), []);

  // The admin zone closes itself after 5 minutes without operator activity (PHASE-3 §2.2).
  useEffect(() => {
    if (!adminOpen) return;
    lastActivityRef.current = Date.now();
    const mark = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= ADMIN_IDLE_MS) {
        setAdminOpen(false);
        setNotice({ kind: 'info', text: pl.gate.sessionExpired });
      }
    }, 15_000);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
      window.clearInterval(timer);
    };
  }, [adminOpen]);

  const refresh = useCallback((next: AppState) => {
    setState(next);
    setStateEpoch((epoch) => epoch + 1);
  }, []);

  const enterApp = useCallback((next: AppState) => {
    refresh(next);
    setScreen('app');
    // Right after unlocking, the operator usually continues preparing the event.
    if (next.event.phase === 'SETUP') openAdminSession();
  }, [openAdminSession, refresh]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await operation();
    } finally {
      setBusy(false);
    }
  }, []);

  const setupPassword = useCallback(async (password: string) => {
    const next = await run(() =>
      store.initialize(password, createInitialState(new Date().getFullYear()), { calibrate: true }));
    enterApp(next);
  }, [enterApp, run, store]);

  const unlock = useCallback(async (password: string) => {
    const next = await run(() => store.unlock(password));
    enterApp(next);
  }, [enterApp, run, store]);

  const lockApp = useCallback(() => {
    store.lock();
    setState(null);
    setAdminOpen(false);
    setGateOpen(false);
    setHasSaved(store.hasSavedState());
    setScreen('locked');
  }, [store]);

  const dispatch = useCallback(async (action: AppAction) => {
    const next = await run(() => store.dispatch(action));
    refresh(next);
    return next;
  }, [refresh, run, store]);

  const drawParticipant = useCallback(async (giverId: string) => {
    const result = await run(() => store.draw(giverId, createCryptoRandom(globalThis.crypto)));
    refresh(result.state);
    if (result.draw === null) {
      throw new StateError('UNKNOWN_DRAW', 'Sesja ujawnienia została już zakończona.');
    }
    return result.draw;
  }, [refresh, run, store]);

  const undoLastDraw = useCallback(async (password: string) => {
    const next = await run(() => store.undoLastDraw(password, true));
    refresh(next);
  }, [refresh, run, store]);

  const resetDrawing = useCallback(async (password: string) => {
    const next = await run(() => store.resetDrawing(password, 'RESET'));
    refresh(next);
  }, [refresh, run, store]);

  const exportBackup = useCallback((password: string) =>
    run(() => store.exportBackup(password)), [run, store]);

  const importBackup = useCallback(async (raw: string, password: string, confirmed: boolean) => {
    const next = await run(() => store.importBackup(raw, password, confirmed));
    refresh(next);
  }, [refresh, run, store]);

  const resetAll = useCallback(() => {
    store.resetAll('RESET');
    setState(null);
    setAdminOpen(false);
    setGateOpen(false);
    setHasSaved(false);
    setScreen('locked');
  }, [store]);

  const requestAdmin = useCallback(() => {
    // Opening the zone always asks for the password again; the only exception is the
    // session started automatically right after unlocking (handled in enterApp).
    if (!adminOpen) setGateOpen(true);
  }, [adminOpen]);

  const submitGate = useCallback(async (password: string) => {
    const ok = await run(() => store.verifyPassword(password));
    if (ok) openAdminSession();
    return ok;
  }, [openAdminSession, run, store]);

  const closeGate = useCallback(() => setGateOpen(false), []);

  return {
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
    drawParticipant,
    undoLastDraw,
    resetDrawing,
    exportBackup,
    importBackup,
    resetAll,
    requestAdmin,
    submitGate,
    closeGate,
    closeAdmin,
  };
}
