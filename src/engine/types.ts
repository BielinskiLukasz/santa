export type ParticipantId = string;

// The order of participants in the array is their order in the circle.
export interface Participant {
  readonly id: ParticipantId;
  readonly name: string;
  readonly animal: string;
}

export type RuleReason = 'COUPLE' | 'LAST_YEAR' | 'MANUAL';

export interface Rule {
  readonly giverId: ParticipantId;
  readonly receiverId: ParticipantId;
  readonly reason: RuleReason;
}

export interface Couple {
  readonly firstId: ParticipantId;
  readonly secondId: ParticipantId;
}

export interface PreviousDraw {
  readonly giverId: ParticipantId;
  readonly receiverId: ParticipantId;
}

export interface Draw extends PreviousDraw {
  readonly revealCompleted: boolean;
}

export type EventPhase = 'LOCKED' | 'SETUP' | 'BUDGET' | 'DRAWING' | 'DONE';

export interface Event {
  readonly year: number;
  readonly currency: string;
  readonly phase: EventPhase;
  readonly budget: number | null;
}

export interface EventState {
  readonly event: Event;
  readonly participants: readonly Participant[];
  readonly rules: readonly Rule[];
  readonly draws: readonly Draw[];
}

export type MatchingGraph = ReadonlyMap<ParticipantId, readonly ParticipantId[]>;
export type Random = (exclusiveUpperBound: number) => number;

export interface RandomValuesProvider {
  getRandomValues(values: Uint32Array): Uint32Array;
}

export interface BudgetRange {
  readonly min: number;
  readonly max: number;
}

export type BudgetValidation =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly code: 'INVALID_RANGE' | 'INVALID_AMOUNT' | 'OUT_OF_RANGE' };

export type ValidationCode =
  | 'EMPTY_PARTICIPANTS'
  | 'PARTICIPANT_COUNT'
  | 'INVALID_PARTICIPANT_ID'
  | 'DUPLICATE_PARTICIPANT_ID'
  | 'EMPTY_NAME'
  | 'EMPTY_ANIMAL'
  | 'DUPLICATE_ANIMAL'
  | 'INVALID_RULE'
  | 'UNKNOWN_PARTICIPANT'
  | 'SELF_RULE'
  | 'NO_PERFECT_MATCHING'
  | 'SINGLE_OPTION';

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly message: string;
  readonly participantIds: readonly ParticipantId[];
}

export interface SetupValidation {
  readonly ok: boolean;
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}

export type EngineErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_STATE'
  | 'UNKNOWN_GIVER'
  | 'NO_VALID_CANDIDATES'
  | 'INVALID_RANDOM';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}