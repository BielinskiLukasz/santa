import type { MatchingGraph, ParticipantId } from './types';

export function hasPerfectMatching(
  graph: MatchingGraph,
  freeGivers: readonly ParticipantId[],
  freeReceivers: readonly ParticipantId[],
): boolean {
  if (
    freeGivers.length !== freeReceivers.length ||
    new Set(freeGivers).size !== freeGivers.length ||
    new Set(freeReceivers).size !== freeReceivers.length
  ) {
    return false;
  }

  const available = new Set(freeReceivers);
  const ownerByReceiver = new Map<ParticipantId, ParticipantId>();

  // Kuhn's augmenting paths keep earlier matches movable while finding a complete assignment.
  function augment(giverId: ParticipantId, visited: Set<ParticipantId>): boolean {
    for (const receiverId of graph.get(giverId) ?? []) {
      if (!available.has(receiverId) || visited.has(receiverId)) continue;
      visited.add(receiverId);
      const owner = ownerByReceiver.get(receiverId);
      if (owner === undefined || augment(owner, visited)) {
        ownerByReceiver.set(receiverId, giverId);
        return true;
      }
    }
    return false;
  }

  return freeGivers.every((giverId) => augment(giverId, new Set<ParticipantId>()));
}