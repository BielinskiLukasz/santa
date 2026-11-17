import { DEFAULT_BUDGET_RANGE, drawFor, undoLastDraw, validCandidates, validateBudget, validateSetup } from '../engine';
import { deriveRules } from './configuration';
import { assertAppState } from './schema';
import { CURRENT_SCHEMA_VERSION, StateError } from './types';
import type { AppAction, AppState, SetupConfiguration } from './types';

export function createInitialState(year: number, currency = 'PLN'): AppState {
  const state: AppState = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    event: { year, currency, phase: 'SETUP', budget: null },
    participants: [],
    rules: [],
    draws: [],
    couples: [],
    previousDraws: [],
    manualRestrictions: [],
    budgetRange: { ...DEFAULT_BUDGET_RANGE },
    settings: { adminPreviewEnabled: false },
  };
  assertAppState(state);
  return state;
}

function requirePhase(state: AppState, ...phases: AppState['event']['phase'][]): void {
  if (!phases.includes(state.event.phase)) {
    throw new StateError('INVALID_PHASE', 'Operacja nie jest dostępna w tej fazie.');
  }
}

function configure(state: AppState, configuration: SetupConfiguration): AppState {
  requirePhase(state, 'SETUP');
  try {
    const participants = configuration.participants.map((person) => ({ ...person }));
    const couples = configuration.couples.map((pair) => ({ ...pair }));
    const previousDraws = configuration.previousDraws.map((entry) => ({ ...entry }));
    const manualRestrictions = configuration.manualRestrictions.map((entry) => ({ ...entry }));
    const next: AppState = {
      ...state,
      event: { ...state.event, currency: configuration.currency, budget: null },
      participants,
      couples,
      previousDraws,
      manualRestrictions,
      rules: deriveRules(participants, couples, previousDraws, manualRestrictions),
      budgetRange: { ...configuration.budgetRange },
      settings: { adminPreviewEnabled: configuration.adminPreviewEnabled },
      draws: [],
    };
    assertAppState(next);
    return next;
  } catch {
    throw new StateError('INVALID_CONFIGURATION', 'Nieprawidłowa konfiguracja wydarzenia.');
  }
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  assertAppState(state);
  switch (action.type) {
    case 'CONFIGURE':
      return configure(state, action.configuration);
    case 'START_BUDGET': {
      requirePhase(state, 'SETUP');
      if (!validateSetup(state.participants, state.rules).ok) {
        throw new StateError('INVALID_CONFIGURATION', 'Nieprawidłowa konfiguracja wydarzenia.');
      }
      return { ...state, event: { ...state.event, phase: 'BUDGET' } };
    }
    case 'SET_BUDGET': {
      requirePhase(state, 'BUDGET');
      const budget = validateBudget(action.amount, state.budgetRange);
      if (!budget.ok) throw new StateError('INVALID_BUDGET', 'Nieprawidłowa kwota budżetu.');
      return { ...state, event: { ...state.event, budget: budget.value } };
    }
    case 'START_DRAWING': {
      requirePhase(state, 'BUDGET');
      if (!validateSetup(state.participants, state.rules).ok) {
        throw new StateError('INVALID_CONFIGURATION', 'Nieprawidłowa konfiguracja wydarzenia.');
      }
      if (!validateBudget(state.event.budget, state.budgetRange).ok) {
        throw new StateError('INVALID_BUDGET', 'Najpierw należy ustalić budżet.');
      }
      return { ...state, event: { ...state.event, phase: 'DRAWING' } };
    }
    case 'DRAW': {
      const previous = state.draws.find((entry) => entry.giverId === action.giverId);
      if (previous) {
        if (previous.receiverId === action.receiverId) return state;
        throw new StateError('INVALID_DRAW', 'Uczestnik ma już zapisany przydział.');
      }
      requirePhase(state, 'DRAWING');
      if (state.draws.some((entry) => !entry.revealCompleted)) {
        throw new StateError('PENDING_REVEAL', 'Najpierw zakończ poprzednią sesję ujawnienia.');
      }
      const candidates = validCandidates(state, action.giverId);
      const index = candidates.indexOf(action.receiverId);
      if (index < 0) throw new StateError('INVALID_DRAW', 'Nieprawidłowy przydział.');
      const result = drawFor(state, action.giverId, () => index);
      return { ...state, draws: result.state.draws };
    }
    case 'COMPLETE_REVEAL': {
      const assignment = state.draws.find((entry) => entry.giverId === action.giverId);
      if (!assignment) throw new StateError('UNKNOWN_DRAW', 'Nieznany przydział.');
      if (assignment.revealCompleted) return state;
      requirePhase(state, 'DRAWING');
      const draws = state.draws.map((entry) => entry.giverId === action.giverId ? { ...entry, revealCompleted: true } : entry);
      const phase = draws.length === state.participants.length ? 'DONE' : 'DRAWING';
      return { ...state, draws, event: { ...state.event, phase } };
    }
    case 'UNDO_LAST_DRAW': {
      requirePhase(state, 'DRAWING', 'DONE');
      if (state.draws.some((entry) => !entry.revealCompleted)) {
        throw new StateError('PENDING_REVEAL', 'Najpierw zakończ sesję ujawnienia.');
      }
      const result = undoLastDraw(state);
      if (result.undoneGiverId === null) return state;
      return { ...state, draws: result.state.draws, event: { ...state.event, phase: 'DRAWING' } };
    }
    case 'RESET_DRAWING':
      if (state.event.phase === 'SETUP') return state;
      requirePhase(state, 'BUDGET', 'DRAWING', 'DONE');
      return { ...state, draws: [], event: { ...state.event, phase: 'BUDGET' } };
    default:
      throw new StateError('INVALID_STATE', 'Nieznana akcja wydarzenia.');
  }
}

export function completeInterruptedReveals(state: AppState): AppState {
  assertAppState(state);
  if (!state.draws.some((entry) => !entry.revealCompleted)) return state;
  const draws = state.draws.map((entry) => entry.revealCompleted ? entry : { ...entry, revealCompleted: true });
  const phase = draws.length === state.participants.length ? 'DONE' : 'DRAWING';
  return { ...state, draws, event: { ...state.event, phase } };
}