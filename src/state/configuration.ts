import { forbiddenFromLastYear, forbiddenFromPairs } from '../engine';
import type { Couple, Participant, PreviousDraw, Rule } from '../engine';

export function deriveRules(
  participants: readonly Participant[],
  couples: readonly Couple[],
  previousDraws: readonly PreviousDraw[],
  manualRestrictions: readonly PreviousDraw[],
): Rule[] {
  const activeIds = new Set(participants.map((participant) => participant.id));
  const lastYear = forbiddenFromLastYear(previousDraws).filter(
    (rule) => activeIds.has(rule.giverId) && activeIds.has(rule.receiverId),
  );
  return [
    ...forbiddenFromPairs(couples),
    ...lastYear,
    ...manualRestrictions.map(({ giverId, receiverId }) => ({ giverId, receiverId, reason: 'MANUAL' as const })),
  ];
}