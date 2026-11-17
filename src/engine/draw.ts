import { hasPerfectMatching } from './matching';
import { buildGraph, isParticipantId } from './rules';
import { EngineError } from './types';
import type { Draw, EventState, MatchingGraph, ParticipantId, Random } from './types';
import { collectDataIssues, MAX_PARTICIPANTS } from './validation';

interface DrawContext {
  readonly ids: readonly ParticipantId[];
  readonly graph: MatchingGraph;
  readonly usedGivers: ReadonlySet<ParticipantId>;
  readonly usedReceivers: ReadonlySet<ParticipantId>;
}

function inspectState(state: EventState): DrawContext {
  if (!state || !Array.isArray(state.participants) || !Array.isArray(state.rules) || !Array.isArray(state.draws)) {
    throw new EngineError('INVALID_STATE', 'Nieprawidłowy stan losowania.');
  }
  if (state.participants.length > MAX_PARTICIPANTS) {
    throw new EngineError('INVALID_STATE', 'Zbyt wielu uczestników losowania.');
  }
  if (collectDataIssues(state.participants, state.rules).length > 0) {
    throw new EngineError('INVALID_STATE', 'Nieprawidłowa konfiguracja losowania.');
  }

  const ids = state.participants.map((participant) => participant.id);
  const graph = buildGraph(state.participants, state.rules);
  const usedGivers = new Set<ParticipantId>();
  const usedReceivers = new Set<ParticipantId>();

  for (const draw of state.draws) {
    if (
      !draw ||
      !isParticipantId(draw.giverId) ||
      !isParticipantId(draw.receiverId) ||
      typeof draw.revealCompleted !== 'boolean' ||
      usedGivers.has(draw.giverId) ||
      usedReceivers.has(draw.receiverId) ||
      !graph.get(draw.giverId)?.includes(draw.receiverId)
    ) {
      throw new EngineError('INVALID_STATE', 'Nieprawidłowy zapis przydziałów.');
    }
    usedGivers.add(draw.giverId);
    usedReceivers.add(draw.receiverId);
  }

  return { ids, graph, usedGivers, usedReceivers };
}

function candidatesFor(context: DrawContext, giverId: ParticipantId): ParticipantId[] {
  if (!context.ids.includes(giverId)) {
    throw new EngineError('UNKNOWN_GIVER', 'Nieznany uczestnik losowania.');
  }
  if (context.usedGivers.has(giverId)) return [];

  const remainingGivers = context.ids.filter((id) => id !== giverId && !context.usedGivers.has(id));
  const freeReceivers = context.ids.filter((id) => !context.usedReceivers.has(id));
  return (context.graph.get(giverId) ?? []).filter((receiverId) => {
    if (context.usedReceivers.has(receiverId)) return false;
    const remainingReceivers = freeReceivers.filter((id) => id !== receiverId);
    return hasPerfectMatching(context.graph, remainingGivers, remainingReceivers);
  });
}

export function validCandidates(state: EventState, giverId: ParticipantId): ParticipantId[] {
  return candidatesFor(inspectState(state), giverId);
}

export function drawFor(
  state: EventState,
  giverId: ParticipantId,
  random: Random,
): { readonly state: EventState; readonly draw: Draw } {
  const context = inspectState(state);
  if (!context.ids.includes(giverId)) {
    throw new EngineError('UNKNOWN_GIVER', 'Nieznany uczestnik losowania.');
  }
  const previous = state.draws.find((draw) => draw.giverId === giverId);
  if (previous) return { state, draw: previous };

  const candidates = candidatesFor(context, giverId);
  if (candidates.length === 0) {
    throw new EngineError('NO_VALID_CANDIDATES', 'Brak poprawnego przydziału.');
  }
  const index = random(candidates.length);
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
    throw new EngineError('INVALID_RANDOM', 'Źródło losowe zwróciło niepoprawną wartość.');
  }
  const receiverId = candidates[index];
  if (receiverId === undefined) {
    throw new EngineError('INVALID_RANDOM', 'Źródło losowe zwróciło niepoprawną wartość.');
  }

  const draw: Draw = { giverId, receiverId, revealCompleted: false };
  return { state: { ...state, draws: [...state.draws, draw] }, draw };
}

export function undoLastDraw(
  state: EventState,
): { readonly state: EventState; readonly undoneGiverId: ParticipantId | null } {
  inspectState(state);
  const last = state.draws.at(-1);
  if (!last) return { state, undoneGiverId: null };
  return {
    state: { ...state, draws: state.draws.slice(0, -1) },
    undoneGiverId: last.giverId,
  };
}