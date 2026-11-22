import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CircleHelp,
  Download,
  ListChecks,
  PawPrint,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Shuffle,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../engine';
import type { AppAction, AppState } from '../state';
import { pl } from '../i18n/pl';
import { ANIMALS } from './animals';
import { errorText } from './controller';
import type { ConfigDraft } from './draft';
import {
  assignAnimals,
  draftFromState,
  emptyParticipant,
  toConfiguration,
  validateDraft,
  withoutParticipant,
} from './draft';
import { AnimalDisc, DangerButton, Field, GhostButton, Panel, PrimaryButton, inputClass } from './widgets';

type Notify = (kind: 'info' | 'error', text: string) => void;
type Dispatch = (action: AppAction) => Promise<AppState>;

const selectClass = inputClass;

function PersonSelect({
  value,
  onChange,
  participants,
  placeholder,
  excludeId,
}: {
  value: string;
  onChange: (id: string) => void;
  participants: readonly { id: string; name: string }[];
  placeholder: string;
  excludeId?: string;
}) {
  return (
    <select
      className={selectClass}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={placeholder}
    >
      <option value="">{placeholder}</option>
      {participants
        .filter((person) => person.id !== excludeId)
        .map((person) => (
          <option key={person.id} value={person.id}>
            {person.name || pl.common.participantFallback}
          </option>
        ))}
    </select>
  );
}

function PairEntryRow({
  left,
  right,
  arrow,
  onRemove,
  disabled,
}: {
  left: string;
  right: string;
  arrow: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-forest/10">
      <span className="font-semibold text-ink">{left}</span>
      <span aria-hidden="true" className="text-mist">{arrow}</span>
      <span className="font-semibold text-ink">{right}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={pl.admin.removeRule}
        className="ml-auto rounded-full p-1.5 text-seal transition hover:bg-seal/10 disabled:opacity-40"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </li>
  );
}

export function AdminZone({
  state,
  busy,
  onClose,
  onHelp,
  onDispatch,
  onUndo,
  onResetDrawing,
  onExport,
  onImport,
  onResetAll,
  showNotice,
}: {
  state: AppState;
  busy: boolean;
  onClose: () => void;
  onHelp: () => void;
  onDispatch: Dispatch;
  onUndo: (password: string) => Promise<void>;
  onResetDrawing: (password: string) => Promise<void>;
  onExport: (password: string) => Promise<string>;
  onImport: (raw: string, password: string, confirmed: boolean) => Promise<void>;
  onResetAll: () => void;
  showNotice: Notify;
}) {
  const editable = state.event.phase === 'SETUP';
  const [draft, setDraft] = useState<ConfigDraft>(() => draftFromState(state));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(toConfiguration(draftFromState(state))));
  const dirty = JSON.stringify(toConfiguration(draft)) !== savedSnapshot;
  const validation = useMemo(() => validateDraft(draft), [draft]);

  const [coupleA, setCoupleA] = useState('');
  const [coupleB, setCoupleB] = useState('');
  const [previousGiver, setPreviousGiver] = useState('');
  const [previousReceiver, setPreviousReceiver] = useState('');
  const [manualGiver, setManualGiver] = useState('');
  const [manualReceiver, setManualReceiver] = useState('');

  const [actionPassword, setActionPassword] = useState('');
  const [dataError, setDataError] = useState<string | null>(null);
  const [undoArmed, setUndoArmed] = useState(false);
  const [importRaw, setImportRaw] = useState<string | null>(null);
  const [importName, setImportName] = useState('');
  const [importConfirmed, setImportConfirmed] = useState(false);
  const [resetDrawingPhrase, setResetDrawingPhrase] = useState('');
  const [resetAllPhrase, setResetAllPhrase] = useState('');

  const nameOf = (id: string) =>
    draft.participants.find((person) => person.id === id)?.name || pl.common.participantFallback;
  const stateNameOf = (id: string) =>
    state.participants.find((person) => person.id === id)?.name || pl.common.participantFallback;

  const saveConfiguration = async () => {
    try {
      const configuration = toConfiguration(draft);
      await onDispatch({ type: 'CONFIGURE', configuration });
      setSavedSnapshot(JSON.stringify(configuration));
      showNotice('info', pl.admin.saved);
    } catch (cause) {
      showNotice('error', errorText(cause));
    }
  };

  const approve = async () => {
    try {
      await onDispatch({ type: 'START_BUDGET' });
      showNotice('info', pl.admin.approved);
      onClose();
    } catch (cause) {
      showNotice('error', errorText(cause));
    }
  };

  const runDataAction = async (action: () => Promise<void>, doneText?: string) => {
    setDataError(null);
    try {
      await action();
      if (doneText) showNotice('info', doneText);
    } catch (cause) {
      setDataError(errorText(cause));
    }
  };

  const doExport = () =>
    runDataAction(async () => {
      const backup = await onExport(actionPassword);
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zwierzeta-losuja-kopia.json';
      link.click();
      URL.revokeObjectURL(url);
    });

  const doImport = () =>
    runDataAction(async () => {
      if (importRaw === null) return;
      await onImport(importRaw, actionPassword, importConfirmed);
    }, pl.admin.importDone);

  const onPickImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportName(file.name);
    setImportRaw(await file.text());
  };

  const takenAnimals = new Set(draft.participants.map((person) => person.animal).filter(Boolean));

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-night/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={pl.admin.title}>
      <div className="mx-auto w-full max-w-4xl animate-fade-up">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-forest p-5 text-cream shadow-xl sm:p-6">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <PawPrint size={22} aria-hidden="true" /> {pl.admin.title}
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-cream/80">{pl.admin.subtitle}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gold">{pl.gate.sessionHint}</p>
          </div>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={onHelp}
              aria-label={pl.event.helpButton}
              title={pl.event.helpButton}
              className="grid h-11 w-11 place-items-center rounded-full border border-cream/50 text-cream transition hover:bg-cream/10"
            >
              <CircleHelp size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cream px-4 text-sm font-bold text-forest transition hover:bg-paper"
            >
              <X size={16} aria-hidden="true" /> {pl.admin.close}
            </button>
          </span>
        </header>

        <div className="mt-4 grid gap-4 pb-8">
          {!editable ? (
            <p className="flex gap-2 rounded-3xl bg-gold/25 p-4 text-sm leading-relaxed text-cream ring-1 ring-gold/40">
              <ShieldAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
              {pl.admin.readOnlyNote}
            </p>
          ) : null}
          {dirty && editable ? (
            <p className="rounded-3xl bg-clay/90 p-4 text-sm font-semibold text-cream">{pl.admin.unsaved}</p>
          ) : null}

          <Panel title={pl.admin.participantsTitle} hint={pl.admin.participantsHint}>
            <ul className="grid gap-2">
              {draft.participants.map((person, index) => (
                <li key={person.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2.5 ring-1 ring-forest/10">
                  <AnimalDisc animalId={person.animal} size={38} />
                  <input
                    className={`${inputClass} min-w-36 flex-1`}
                    value={person.name}
                    disabled={!editable}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        participants: current.participants.map((entry) =>
                          entry.id === person.id ? { ...entry, name: event.target.value } : entry),
                      }))}
                    placeholder={pl.admin.participantNamePlaceholder}
                    aria-label={pl.admin.participantNamePlaceholder}
                  />
                  <select
                    className={`${selectClass} w-44`}
                    value={person.animal}
                    disabled={!editable}
                    aria-label={pl.admin.animalPlaceholder}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        participants: current.participants.map((entry) =>
                          entry.id === person.id ? { ...entry, animal: event.target.value } : entry),
                      }))}
                  >
                    <option value="">{pl.admin.animalPlaceholder}</option>
                    {ANIMALS.map((animal) => (
                      <option
                        key={animal.id}
                        value={animal.id}
                        disabled={animal.id !== person.animal && takenAnimals.has(animal.id)}
                      >
                        {animal.name}
                      </option>
                    ))}
                  </select>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      aria-label={pl.admin.moveUp}
                      disabled={!editable || index === 0}
                      className="rounded-full p-2 text-forest transition hover:bg-forest/10 disabled:opacity-30"
                      onClick={() =>
                        setDraft((current) => {
                          const participants = [...current.participants];
                          const [moved] = participants.splice(index, 1);
                          if (moved) participants.splice(index - 1, 0, moved);
                          return { ...current, participants };
                        })}
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={pl.admin.moveDown}
                      disabled={!editable || index === draft.participants.length - 1}
                      className="rounded-full p-2 text-forest transition hover:bg-forest/10 disabled:opacity-30"
                      onClick={() =>
                        setDraft((current) => {
                          const participants = [...current.participants];
                          const [moved] = participants.splice(index, 1);
                          if (moved) participants.splice(index + 1, 0, moved);
                          return { ...current, participants };
                        })}
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={pl.admin.removeParticipant}
                      disabled={!editable}
                      className="rounded-full p-2 text-seal transition hover:bg-seal/10 disabled:opacity-30"
                      onClick={() => setDraft((current) => withoutParticipant(current, person.id))}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {editable ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <GhostButton
                  disabled={draft.participants.length >= MAX_PARTICIPANTS}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      participants: [...current.participants, emptyParticipant(current.participants)],
                    }))}
                >
                  <Plus size={16} aria-hidden="true" /> {pl.admin.addParticipant}
                </GhostButton>
                <GhostButton
                  onClick={() =>
                    setDraft((current) => assignAnimals(current, (bound) => Math.floor(Math.random() * bound)))}
                >
                  <Shuffle size={16} aria-hidden="true" /> {pl.admin.randomAnimals}
                </GhostButton>
                <span className="self-center text-xs font-semibold text-mist">
                  {draft.participants.length} / {MIN_PARTICIPANTS}–{MAX_PARTICIPANTS}
                </span>
              </div>
            ) : null}
          </Panel>

          <Panel title={pl.admin.rulesTitle}>
            <div className="grid gap-6">
              <div>
                <h4 className="text-sm font-bold text-ink">{pl.admin.couplesTitle}</h4>
                <p className="mt-0.5 text-xs text-mist">{pl.admin.couplesHint}</p>
                <ul className="mt-2 grid gap-1.5">
                  {draft.couples.map((couple, index) => (
                    <PairEntryRow
                      key={`${couple.firstId}-${couple.secondId}-${index}`}
                      left={nameOf(couple.firstId)}
                      right={nameOf(couple.secondId)}
                      arrow="↔"
                      disabled={!editable}
                      onRemove={() =>
                        setDraft((current) => ({ ...current, couples: current.couples.filter((_, i) => i !== index) }))}
                    />
                  ))}
                </ul>
                {editable ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="min-w-40 flex-1">
                      <PersonSelect value={coupleA} onChange={setCoupleA} participants={draft.participants} placeholder={pl.admin.giverPlaceholder} excludeId={coupleB} />
                    </span>
                    <span className="min-w-40 flex-1">
                      <PersonSelect value={coupleB} onChange={setCoupleB} participants={draft.participants} placeholder={pl.admin.receiverPlaceholder} excludeId={coupleA} />
                    </span>
                    <GhostButton
                      disabled={!coupleA || !coupleB}
                      onClick={() => {
                        setDraft((current) => ({ ...current, couples: [...current.couples, { firstId: coupleA, secondId: coupleB }] }));
                        setCoupleA('');
                        setCoupleB('');
                      }}
                    >
                      <Plus size={16} aria-hidden="true" /> {pl.admin.addRule}
                    </GhostButton>
                  </div>
                ) : null}
              </div>

              <div>
                <h4 className="text-sm font-bold text-ink">{pl.admin.previousTitle}</h4>
                <p className="mt-0.5 text-xs text-mist">{pl.admin.previousHint}</p>
                <ul className="mt-2 grid gap-1.5">
                  {draft.previousDraws.map((entry, index) => (
                    <PairEntryRow
                      key={`${entry.giverId}-${entry.receiverId}-${index}`}
                      left={nameOf(entry.giverId)}
                      right={nameOf(entry.receiverId)}
                      arrow="→"
                      disabled={!editable}
                      onRemove={() =>
                        setDraft((current) => ({ ...current, previousDraws: current.previousDraws.filter((_, i) => i !== index) }))}
                    />
                  ))}
                </ul>
                {editable ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="min-w-40 flex-1">
                      <PersonSelect value={previousGiver} onChange={setPreviousGiver} participants={draft.participants} placeholder={pl.admin.giverPlaceholder} excludeId={previousReceiver} />
                    </span>
                    <span className="min-w-40 flex-1">
                      <PersonSelect value={previousReceiver} onChange={setPreviousReceiver} participants={draft.participants} placeholder={pl.admin.receiverPreviousPlaceholder} excludeId={previousGiver} />
                    </span>
                    <GhostButton
                      disabled={!previousGiver || !previousReceiver}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          previousDraws: [...current.previousDraws, { giverId: previousGiver, receiverId: previousReceiver }],
                        }));
                        setPreviousGiver('');
                        setPreviousReceiver('');
                      }}
                    >
                      <Plus size={16} aria-hidden="true" /> {pl.admin.addRule}
                    </GhostButton>
                  </div>
                ) : null}
              </div>

              <div>
                <h4 className="text-sm font-bold text-ink">{pl.admin.manualTitle}</h4>
                <p className="mt-0.5 text-xs text-mist">{pl.admin.manualHint}</p>
                <ul className="mt-2 grid gap-1.5">
                  {draft.manualRestrictions.map((entry, index) => (
                    <PairEntryRow
                      key={`${entry.giverId}-${entry.receiverId}-${index}`}
                      left={nameOf(entry.giverId)}
                      right={nameOf(entry.receiverId)}
                      arrow="→"
                      disabled={!editable}
                      onRemove={() =>
                        setDraft((current) => ({ ...current, manualRestrictions: current.manualRestrictions.filter((_, i) => i !== index) }))}
                    />
                  ))}
                </ul>
                {editable ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="min-w-40 flex-1">
                      <PersonSelect value={manualGiver} onChange={setManualGiver} participants={draft.participants} placeholder={pl.admin.giverPlaceholder} excludeId={manualReceiver} />
                    </span>
                    <span className="min-w-40 flex-1">
                      <PersonSelect value={manualReceiver} onChange={setManualReceiver} participants={draft.participants} placeholder={pl.admin.receiverPlaceholder} excludeId={manualGiver} />
                    </span>
                    <GhostButton
                      disabled={!manualGiver || !manualReceiver}
                      onClick={() => {
                        setDraft((current) => ({
                          ...current,
                          manualRestrictions: [...current.manualRestrictions, { giverId: manualGiver, receiverId: manualReceiver }],
                        }));
                        setManualGiver('');
                        setManualReceiver('');
                      }}
                    >
                      <Plus size={16} aria-hidden="true" /> {pl.admin.addRule}
                    </GhostButton>
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title={pl.admin.optionsTitle}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={pl.admin.currencyLabel}>
                <input
                  className={inputClass}
                  value={draft.currency}
                  disabled={!editable}
                  onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value }))}
                />
              </Field>
              <Field label={pl.admin.budgetMinLabel}>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={Number.isNaN(draft.budgetMin) ? '' : draft.budgetMin}
                  disabled={!editable}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, budgetMin: Number.parseInt(event.target.value, 10) }))}
                />
              </Field>
              <Field label={pl.admin.budgetMaxLabel}>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={Number.isNaN(draft.budgetMax) ? '' : draft.budgetMax}
                  disabled={!editable}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, budgetMax: Number.parseInt(event.target.value, 10) }))}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-mist">{pl.admin.budgetRangeHint}</p>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-forest/10">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#345145]"
                checked={draft.adminPreviewEnabled}
                disabled={!editable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, adminPreviewEnabled: event.target.checked }))}
              />
              <span>
                <span className="block text-sm font-bold text-ink">{pl.admin.adminPreviewLabel}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-mist">{pl.admin.adminPreviewHint}</span>
              </span>
            </label>
          </Panel>

          <Panel title={pl.admin.summaryTitle}>
            <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[
                [pl.admin.summaryParticipants, draft.participants.length],
                [pl.admin.summaryCouples, draft.couples.length],
                [pl.admin.summaryRestrictions, draft.previousDraws.length + draft.manualRestrictions.length],
                [pl.admin.summaryDraws, state.draws.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white p-3 ring-1 ring-forest/10">
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">{label}</dt>
                  <dd className="mt-1 font-display text-2xl font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            {validation.errors.length > 0 || validation.problems.length > 0 ? (
              <div className="mt-4 rounded-2xl bg-seal/10 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-seal">
                  <AlertTriangle size={16} aria-hidden="true" /> {pl.admin.errorsTitle}
                </h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                  {validation.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                  {validation.errors.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      {issue.message}
                      {issue.participantIds.length > 0
                        ? ` (${issue.participantIds.map(nameOf).join(', ')})`
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {validation.warnings.length > 0 ? (
              <div className="mt-3 rounded-2xl bg-gold/20 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <AlertTriangle size={16} aria-hidden="true" /> {pl.admin.warningsTitle}
                </h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                  {validation.warnings.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      {issue.message}
                      {issue.participantIds.length > 0
                        ? ` (${issue.participantIds.map(nameOf).join(', ')})`
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {editable ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <PrimaryButton busy={busy} disabled={!dirty} onClick={saveConfiguration}>
                  <Save size={16} aria-hidden="true" /> {pl.admin.saveConfiguration}
                </PrimaryButton>
                <PrimaryButton
                  busy={busy}
                  disabled={dirty || !validation.ok}
                  onClick={approve}
                >
                  <Check size={16} aria-hidden="true" /> {pl.admin.approve}
                </PrimaryButton>
                <span className="text-xs text-mist">
                  {dirty ? pl.admin.approveSavedFirst : pl.admin.approveHint}
                </span>
              </div>
            ) : null}
          </Panel>

          <Panel title={pl.admin.previewTitle}>
            {!state.settings.adminPreviewEnabled ? (
              <p className="text-sm text-mist">{pl.admin.previewDisabled}</p>
            ) : state.draws.length === 0 ? (
              <p className="text-sm text-mist">{pl.admin.previewEmpty}</p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {state.draws.map((draw) => (
                  <li key={draw.giverId} className="rounded-xl bg-white px-3 py-2 ring-1 ring-forest/10">
                    {pl.admin.previewPair(stateNameOf(draw.giverId), stateNameOf(draw.receiverId))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={pl.admin.dataTitle} hint={pl.admin.actionPasswordHint}>
            <div className="grid gap-6">
              <Field label={pl.common.operatorPassword}>
                <input
                  type="password"
                  autoComplete="current-password"
                  className={inputClass}
                  value={actionPassword}
                  onChange={(event) => setActionPassword(event.target.value)}
                />
              </Field>
              {dataError ? <p role="alert" className="text-sm font-semibold text-seal">{dataError}</p> : null}

              <div className="rounded-2xl bg-white p-4 ring-1 ring-forest/10">
                <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Undo2 size={16} aria-hidden="true" /> {pl.admin.undoTitle}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-mist">{pl.admin.undoHint}</p>
                <div className="mt-3">
                  {undoArmed ? (
                    <DangerButton
                      busy={busy}
                      disabled={actionPassword.length === 0}
                      onClick={() =>
                        runDataAction(async () => {
                          await onUndo(actionPassword);
                          setUndoArmed(false);
                        }, pl.admin.undoDone)}
                    >
                      {pl.admin.undoConfirm}
                    </DangerButton>
                  ) : (
                    <GhostButton disabled={state.draws.length === 0} onClick={() => setUndoArmed(true)}>
                      {state.draws.length === 0 ? pl.admin.undoNone : pl.admin.undoSubmit}
                    </GhostButton>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-forest/10">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Download size={16} aria-hidden="true" /> {pl.admin.exportTitle}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-mist">{pl.admin.exportHint}</p>
                  <div className="mt-3">
                    <GhostButton disabled={actionPassword.length === 0} onClick={doExport}>
                      {pl.admin.exportSubmit}
                    </GhostButton>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 ring-1 ring-forest/10">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Upload size={16} aria-hidden="true" /> {pl.admin.importTitle}
                  </h4>
                  <p className="mt-1 text-sm leading-relaxed text-mist">{pl.admin.importHint}</p>
                  <label className="mt-3 block">
                    <span className="sr-only">{pl.admin.importPickFile}</span>
                    <input type="file" accept="application/json,.json" className="w-full text-sm" onChange={onPickImportFile} />
                  </label>
                  {importName ? <p className="mt-1 text-xs font-semibold text-mist">{importName}</p> : null}
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[#345145]"
                      checked={importConfirmed}
                      onChange={(event) => setImportConfirmed(event.target.checked)}
                    />
                    {pl.admin.importConfirm}
                  </label>
                  <div className="mt-3">
                    <GhostButton
                      disabled={importRaw === null || !importConfirmed || actionPassword.length === 0}
                      onClick={doImport}
                    >
                      {pl.admin.importSubmit}
                    </GhostButton>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-seal/5 p-4 ring-1 ring-seal/25">
                <h4 className="flex items-center gap-2 text-sm font-bold text-seal">
                  <RotateCcw size={16} aria-hidden="true" /> {pl.admin.resetDrawingTitle}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-mist">{pl.admin.resetDrawingHint}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label={pl.locked.resetConfirmLabel}>
                    <input
                      className={inputClass}
                      value={resetDrawingPhrase}
                      onChange={(event) => setResetDrawingPhrase(event.target.value)}
                      placeholder="RESET"
                      autoComplete="off"
                    />
                  </Field>
                  <DangerButton
                    busy={busy}
                    disabled={resetDrawingPhrase !== 'RESET' || actionPassword.length === 0 || state.event.phase === 'SETUP'}
                    onClick={() =>
                      runDataAction(async () => {
                        await onResetDrawing(actionPassword);
                        setResetDrawingPhrase('');
                      }, pl.admin.resetDrawingDone)}
                  >
                    {pl.admin.resetDrawingSubmit}
                  </DangerButton>
                </div>
              </div>

              <div className="rounded-2xl bg-seal/10 p-4 ring-1 ring-seal/40">
                <h4 className="flex items-center gap-2 text-sm font-bold text-seal">
                  <ShieldAlert size={16} aria-hidden="true" /> {pl.admin.resetAllTitle}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-ink">{pl.locked.resetWarning}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label={pl.locked.resetConfirmLabel}>
                    <input
                      className={inputClass}
                      value={resetAllPhrase}
                      onChange={(event) => setResetAllPhrase(event.target.value)}
                      placeholder="RESET"
                      autoComplete="off"
                    />
                  </Field>
                  <DangerButton
                    disabled={resetAllPhrase !== 'RESET'}
                    onClick={() => {
                      showNotice('info', pl.locked.resetDone);
                      onResetAll();
                    }}
                  >
                    {pl.admin.resetAllSubmit}
                  </DangerButton>
                </div>
              </div>

              <p className="flex items-center gap-2 text-xs text-mist">
                <ListChecks size={14} aria-hidden="true" /> {pl.gate.neverOnEventScreen}
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
