import type {
  BudgetRange,
  Couple,
  EventState,
  Participant,
  PreviousDraw,
} from '../engine';

export const CURRENT_SCHEMA_VERSION = 1 as const;

export interface SetupConfiguration {
  readonly participants: readonly Participant[];
  readonly couples: readonly Couple[];
  readonly previousDraws: readonly PreviousDraw[];
  readonly manualRestrictions: readonly PreviousDraw[];
  readonly currency: string;
  readonly budgetRange: BudgetRange;
  readonly adminPreviewEnabled: boolean;
}

export interface AppState extends EventState {
  readonly schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  readonly couples: readonly Couple[];
  readonly previousDraws: readonly PreviousDraw[];
  readonly manualRestrictions: readonly PreviousDraw[];
  readonly budgetRange: BudgetRange;
  readonly settings: { readonly adminPreviewEnabled: boolean };
}

export type AppAction =
  | { readonly type: 'CONFIGURE'; readonly configuration: SetupConfiguration }
  | { readonly type: 'START_BUDGET' }
  | { readonly type: 'SET_BUDGET'; readonly amount: number }
  | { readonly type: 'START_DRAWING' }
  | { readonly type: 'DRAW'; readonly giverId: string; readonly receiverId: string }
  | { readonly type: 'COMPLETE_REVEAL'; readonly giverId: string }
  | { readonly type: 'UNDO_LAST_DRAW' }
  | { readonly type: 'RESET_DRAWING' };

export type StateErrorCode =
  | 'INVALID_STATE'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_CONFIGURATION'
  | 'INVALID_PHASE'
  | 'INVALID_BUDGET'
  | 'PENDING_REVEAL'
  | 'INVALID_DRAW'
  | 'UNKNOWN_DRAW';

export class StateError extends Error {
  constructor(
    readonly code: StateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StateError';
  }
}