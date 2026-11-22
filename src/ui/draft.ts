import { MAX_PARTICIPANTS, MIN_PARTICIPANTS, validateBudget, validateSetup } from '../engine';
import type { Couple, Participant, PreviousDraw, Random, ValidationIssue } from '../engine';
import { deriveRules } from '../state/configuration';
import type { AppState, SetupConfiguration } from '../state';
import { ANIMALS } from './animals';

export interface ConfigDraft {
  participants: Participant[];
  couples: Couple[];
  previousDraws: PreviousDraw[];
  manualRestrictions: PreviousDraw[];
  currency: string;
  budgetMin: number;
  budgetMax: number;
  adminPreviewEnabled: boolean;
}

export function draftFromState(state: AppState): ConfigDraft {
  return {
    participants: state.participants.map((person) => ({ ...person })),
    couples: state.couples.map((pair) => ({ ...pair })),
    previousDraws: state.previousDraws.map((entry) => ({ ...entry })),
    manualRestrictions: state.manualRestrictions.map((entry) => ({ ...entry })),
    currency: state.event.currency,
    budgetMin: state.budgetRange.min,
    budgetMax: state.budgetRange.max,
    adminPreviewEnabled: state.settings.adminPreviewEnabled,
  };
}

export function toConfiguration(draft: ConfigDraft): SetupConfiguration {
  return {
    participants: draft.participants.map((person) => ({
      id: person.id,
      name: person.name.trim(),
      animal: person.animal,
    })),
    couples: draft.couples.map((pair) => ({ ...pair })),
    previousDraws: draft.previousDraws.map((entry) => ({ ...entry })),
    manualRestrictions: draft.manualRestrictions.map((entry) => ({ ...entry })),
    currency: draft.currency.trim(),
    budgetRange: { min: draft.budgetMin, max: draft.budgetMax },
    adminPreviewEnabled: draft.adminPreviewEnabled,
  };
}

export interface DraftValidation {
  // Blocking problems (engine issues with participant identifiers for the operator).
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
  // Draft-level problems the engine does not report (duplicated pairs, broken permutation...).
  readonly problems: readonly string[];
  readonly rangeInvalid: boolean;
  readonly ok: boolean;
}

function samePair(a: PreviousDraw, b: PreviousDraw): boolean {
  return a.giverId === b.giverId && a.receiverId === b.receiverId;
}

function draftProblems(draft: ConfigDraft): string[] {
  const problems: string[] = [];
  const ids = new Set(draft.participants.map((person) => person.id));
  const known = (entry: PreviousDraw) => ids.has(entry.giverId) && ids.has(entry.receiverId);

  draft.couples.forEach((couple, index) => {
    if (couple.firstId === couple.secondId) problems.push('Para nie może łączyć osoby z samą sobą.');
    if (!ids.has(couple.firstId) || !ids.has(couple.secondId)) problems.push('Para wskazuje usuniętego uczestnika.');
    const duplicate = draft.couples.some((other, otherIndex) =>
      otherIndex < index &&
      ((other.firstId === couple.firstId && other.secondId === couple.secondId) ||
        (other.firstId === couple.secondId && other.secondId === couple.firstId)));
    if (duplicate) problems.push('Ta para jest już na liście.');
  });

  const checkPermutation = (entries: readonly PreviousDraw[], label: string) => {
    const givers = new Set<string>();
    const receivers = new Set<string>();
    for (const entry of entries) {
      if (!known(entry)) problems.push(`${label}: wpis wskazuje usuniętego uczestnika.`);
      if (entry.giverId === entry.receiverId) problems.push(`${label}: osoba nie może występować sama ze sobą.`);
      if (givers.has(entry.giverId)) problems.push(`${label}: ta osoba losująca występuje więcej niż raz.`);
      if (receivers.has(entry.receiverId)) problems.push(`${label}: ta osoba obdarowana występuje więcej niż raz.`);
      givers.add(entry.giverId);
      receivers.add(entry.receiverId);
    }
  };
  checkPermutation(draft.previousDraws, 'Zeszły rok');

  draft.manualRestrictions.forEach((entry, index) => {
    if (!known(entry)) problems.push('Zakaz ręczny wskazuje usuniętego uczestnika.');
    if (entry.giverId === entry.receiverId) problems.push('Zakaz ręczny nie może dotyczyć tej samej osoby.');
    if (draft.manualRestrictions.some((other, otherIndex) => otherIndex < index && samePair(other, entry))) {
      problems.push('Ten zakaz ręczny jest już na liście.');
    }
  });

  return problems;
}

export function validateDraft(draft: ConfigDraft): DraftValidation {
  const configuration = toConfiguration(draft);
  let errors: ValidationIssue[] = [];
  let warnings: ValidationIssue[] = [];
  const problems = draftProblems(draft);
  try {
    const rules = deriveRules(
      configuration.participants,
      configuration.couples,
      configuration.previousDraws,
      configuration.manualRestrictions,
    );
    const setup = validateSetup(configuration.participants, rules);
    errors = [...setup.errors];
    warnings = [...setup.warnings];
  } catch {
    problems.push('Reguły zawierają nieprawidłowe wpisy.');
  }
  const rangeInvalid = !validateBudget(configuration.budgetRange.min, configuration.budgetRange).ok;
  if (rangeInvalid) problems.push('Zakres budżetu jest nieprawidłowy (liczby całkowite, minimum nie większe od maksimum).');
  return {
    errors,
    warnings,
    problems,
    rangeInvalid,
    ok: errors.length === 0 && problems.length === 0,
  };
}

export function participantCountOk(draft: ConfigDraft): boolean {
  return draft.participants.length >= MIN_PARTICIPANTS && draft.participants.length <= MAX_PARTICIPANTS;
}

export function newParticipantId(existing: readonly Participant[]): string {
  const used = new Set(existing.map((person) => person.id));
  let counter = existing.length;
  let id = `uczestnik-${counter}`;
  while (used.has(id)) {
    counter += 1;
    id = `uczestnik-${counter}`;
  }
  return id;
}

export function emptyParticipant(existing: readonly Participant[]): Participant {
  return { id: newParticipantId(existing), name: '', animal: '' };
}

// Drops rules referencing a removed participant so the draft never points at ghosts.
export function withoutParticipant(draft: ConfigDraft, participantId: string): ConfigDraft {
  const keeps = (entry: PreviousDraw) => entry.giverId !== participantId && entry.receiverId !== participantId;
  return {
    ...draft,
    participants: draft.participants.filter((person) => person.id !== participantId),
    couples: draft.couples.filter((pair) => pair.firstId !== participantId && pair.secondId !== participantId),
    previousDraws: draft.previousDraws.filter(keeps),
    manualRestrictions: draft.manualRestrictions.filter(keeps),
  };
}

// Keeps animals already chosen (when unique) and deals the remaining species at random,
// so every participant ends up with a different animal whenever the catalogue allows it.
export function assignAnimals(draft: ConfigDraft, random: Random): ConfigDraft {
  const pool = ANIMALS.map((animal) => animal.id);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapWith = random(index + 1);
    const current = pool[index] as string;
    pool[index] = pool[swapWith] as string;
    pool[swapWith] = current;
  }
  const kept = new Set<string>();
  const participants = draft.participants.map((person) => {
    if (person.animal && !kept.has(person.animal)) {
      kept.add(person.animal);
      return person;
    }
    const next = pool.find((animal) => !kept.has(animal));
    if (next === undefined) return person;
    kept.add(next);
    return { ...person, animal: next };
  });
  return { ...draft, participants };
}
