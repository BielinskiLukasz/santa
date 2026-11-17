import { EngineError } from './types';
import type { Couple, MatchingGraph, Participant, PreviousDraw, Rule, RuleReason } from './types';

export function isParticipantId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isRuleReason(value: unknown): value is RuleReason {
  return value === 'COUPLE' || value === 'LAST_YEAR' || value === 'MANUAL';
}

export function forbiddenFromPairs(couples: readonly Couple[]): Rule[] {
  const rules: Rule[] = [];
  for (const couple of couples) {
    if (!couple || !isParticipantId(couple.firstId) || !isParticipantId(couple.secondId)) {
      throw new EngineError('INVALID_INPUT', 'Para musi zawierać dwa identyfikatory.');
    }
    if (couple.firstId === couple.secondId) {
      throw new EngineError('INVALID_INPUT', 'Para musi zawierać dwie różne osoby.');
    }
    rules.push(
      { giverId: couple.firstId, receiverId: couple.secondId, reason: 'COUPLE' },
      { giverId: couple.secondId, receiverId: couple.firstId, reason: 'COUPLE' },
    );
  }
  return rules;
}

export function forbiddenFromLastYear(draws: readonly PreviousDraw[]): Rule[] {
  const givers = new Set<string>();
  const receivers = new Set<string>();
  const rules: Rule[] = [];

  for (const draw of draws) {
    if (!draw || !isParticipantId(draw.giverId) || !isParticipantId(draw.receiverId)) {
      throw new EngineError('INVALID_INPUT', 'Wynik z zeszłego roku wymaga dwóch identyfikatorów.');
    }
    if (draw.giverId === draw.receiverId) {
      throw new EngineError('INVALID_INPUT', 'Wynik z zeszłego roku nie może wskazywać tej samej osoby.');
    }
    if (givers.has(draw.giverId) || receivers.has(draw.receiverId)) {
      throw new EngineError('INVALID_INPUT', 'Wyniki z zeszłego roku zawierają powtórzenia.');
    }
    givers.add(draw.giverId);
    receivers.add(draw.receiverId);
    rules.push({ giverId: draw.giverId, receiverId: draw.receiverId, reason: 'LAST_YEAR' });
  }
  return rules;
}

export function buildGraph(participants: readonly Participant[], rules: readonly Rule[]): MatchingGraph {
  const ids: string[] = [];
  const known = new Set<string>();
  for (const participant of participants) {
    if (!participant || !isParticipantId(participant.id) || known.has(participant.id)) {
      throw new EngineError('INVALID_INPUT', 'Identyfikatory uczestników muszą być poprawne i unikalne.');
    }
    ids.push(participant.id);
    known.add(participant.id);
  }

  const forbidden = new Map<string, Set<string>>();
  for (const rule of rules) {
    if (
      !rule ||
      !isParticipantId(rule.giverId) ||
      !isParticipantId(rule.receiverId) ||
      !isRuleReason(rule.reason) ||
      !known.has(rule.giverId) ||
      !known.has(rule.receiverId) ||
      rule.giverId === rule.receiverId
    ) {
      throw new EngineError('INVALID_INPUT', 'Nieprawidłowa reguła losowania.');
    }
    const blocked = forbidden.get(rule.giverId) ?? new Set<string>();
    blocked.add(rule.receiverId);
    forbidden.set(rule.giverId, blocked);
  }

  const graph = new Map<string, readonly string[]>();
  for (const giverId of ids) {
    const blocked = forbidden.get(giverId);
    graph.set(giverId, ids.filter((receiverId) => receiverId !== giverId && !blocked?.has(receiverId)));
  }
  return graph;
}