import { buildGraph, hasPerfectMatching, validateBudget, validateSetup } from '../engine';
import { collectDataIssues } from '../engine/validation';
import type { Couple, Draw, Event, Participant, PreviousDraw, Rule } from '../engine';
import { deriveRules } from './configuration';
import { CURRENT_SCHEMA_VERSION, StateError } from './types';
import type { AppState } from './types';

export type StateMigration = (value: unknown) => unknown;
export type StateMigrations = Readonly<Record<number, StateMigration>>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOf<T>(value: unknown, guard: (entry: unknown) => entry is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function participant(value: unknown): value is Participant {
  return record(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.animal === 'string';
}

function couple(value: unknown): value is Couple {
  return record(value) && typeof value.firstId === 'string' && typeof value.secondId === 'string';
}

function previousDraw(value: unknown): value is PreviousDraw {
  return record(value) && typeof value.giverId === 'string' && typeof value.receiverId === 'string';
}

function draw(value: unknown): value is Draw {
  return previousDraw(value) && record(value) && typeof value.revealCompleted === 'boolean';
}

function rule(value: unknown): value is Rule {
  return previousDraw(value) && record(value) &&
    (value.reason === 'COUPLE' || value.reason === 'LAST_YEAR' || value.reason === 'MANUAL');
}

function event(value: unknown): value is Event {
  return record(value) && typeof value.year === 'number' && Number.isSafeInteger(value.year) && value.year > 0 &&
    typeof value.currency === 'string' && value.currency.trim().length > 0 &&
    (value.phase === 'SETUP' || value.phase === 'BUDGET' || value.phase === 'DRAWING' || value.phase === 'DONE') &&
    (value.budget === null || (typeof value.budget === 'number' && Number.isSafeInteger(value.budget)));
}

function invalid(): never {
  throw new StateError('INVALID_STATE', 'Nieprawidłowy stan wydarzenia.');
}

export function assertAppState(value: unknown): asserts value is AppState {
  if (!record(value) || value.schemaVersion !== CURRENT_SCHEMA_VERSION || !event(value.event) ||
    !arrayOf(value.participants, participant) || !arrayOf(value.couples, couple) ||
    !arrayOf(value.previousDraws, previousDraw) || !arrayOf(value.manualRestrictions, previousDraw) ||
    !arrayOf(value.rules, rule) || !arrayOf(value.draws, draw) || !record(value.budgetRange) ||
    typeof value.budgetRange.min !== 'number' || typeof value.budgetRange.max !== 'number' ||
    !record(value.settings) || typeof value.settings.adminPreviewEnabled !== 'boolean') invalid();

  const state = value as unknown as AppState;
  if (state.participants.length > 12 || !validateBudget(state.budgetRange.min, state.budgetRange).ok) invalid();
  if (state.event.budget !== null && !validateBudget(state.event.budget, state.budgetRange).ok) invalid();

  let expectedRules: Rule[];
  try {
    expectedRules = deriveRules(state.participants, state.couples, state.previousDraws, state.manualRestrictions);
  } catch {
    invalid();
  }
  if (expectedRules.length !== state.rules.length || expectedRules.some((expected, index) => {
    const actual = state.rules[index];
    return !actual || actual.giverId !== expected.giverId || actual.receiverId !== expected.receiverId || actual.reason !== expected.reason;
  })) invalid();

  const issues = collectDataIssues(state.participants, state.rules).filter((issue) => issue.code !== 'EMPTY_PARTICIPANTS');
  if (issues.length > 0) invalid();
  if ((state.event.phase === 'SETUP' || state.event.phase === 'BUDGET') && state.draws.length !== 0) invalid();
  if (state.event.phase !== 'SETUP' && !validateSetup(state.participants, state.rules).ok) invalid();
  if ((state.event.phase === 'DRAWING' || state.event.phase === 'DONE') && state.event.budget === null) invalid();

  const graph = buildGraph(state.participants, state.rules);
  const givers = new Set<string>();
  const receivers = new Set<string>();
  for (const [index, assignment] of state.draws.entries()) {
    if (givers.has(assignment.giverId) || receivers.has(assignment.receiverId) ||
      !graph.get(assignment.giverId)?.includes(assignment.receiverId) ||
      (!assignment.revealCompleted && index !== state.draws.length - 1)) invalid();
    givers.add(assignment.giverId);
    receivers.add(assignment.receiverId);
  }

  if (state.event.phase === 'DRAWING' || state.event.phase === 'DONE') {
    const freeGivers = state.participants.map((person) => person.id).filter((id) => !givers.has(id));
    const freeReceivers = state.participants.map((person) => person.id).filter((id) => !receivers.has(id));
    if (!hasPerfectMatching(graph, freeGivers, freeReceivers)) invalid();
    const complete = state.draws.length === state.participants.length && state.draws.every((item) => item.revealCompleted);
    if ((state.event.phase === 'DONE') !== complete) invalid();
  }
}

export function migrateState(value: unknown, migrations: StateMigrations = {}): AppState {
  if (!record(value) || typeof value.schemaVersion !== 'number' || !Number.isSafeInteger(value.schemaVersion)) invalid();
  let current: unknown = value;
  let version = value.schemaVersion;
  if (version < 0 || version > CURRENT_SCHEMA_VERSION) {
    throw new StateError('UNSUPPORTED_VERSION', 'Nieobsługiwana wersja zapisu.');
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) throw new StateError('UNSUPPORTED_VERSION', 'Brak migracji zapisu.');
    current = migrate(current);
    if (!record(current) || current.schemaVersion !== version + 1) invalid();
    version++;
  }
  assertAppState(current);
  return current;
}