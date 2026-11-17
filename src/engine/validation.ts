import { hasPerfectMatching } from './matching';
import { buildGraph, isParticipantId, isRuleReason } from './rules';
import type { Participant, Rule, SetupValidation, ValidationIssue } from './types';

export const MIN_PARTICIPANTS = 7;
export const MAX_PARTICIPANTS = 12;

// Issue identifiers are intended for the protected operator area, not the event screen.
export function collectDataIssues(
  participants: readonly Participant[],
  rules: readonly Rule[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  const animalOwners = new Map<string, string>();

  if (participants.length === 0) {
    issues.push({ code: 'EMPTY_PARTICIPANTS', message: 'Lista uczestników jest pusta.', participantIds: [] });
  }

  for (const participant of participants) {
    if (!participant || typeof participant !== 'object') {
      issues.push({ code: 'INVALID_PARTICIPANT_ID', message: 'Nieprawidłowy uczestnik.', participantIds: [] });
      continue;
    }
    const id = isParticipantId(participant.id) ? participant.id : undefined;
    if (id === undefined) {
      issues.push({ code: 'INVALID_PARTICIPANT_ID', message: 'Uczestnik wymaga identyfikatora.', participantIds: [] });
    } else if (ids.has(id)) {
      issues.push({ code: 'DUPLICATE_PARTICIPANT_ID', message: 'Identyfikator uczestnika się powtarza.', participantIds: [id] });
    } else {
      ids.add(id);
    }

    const affected = id === undefined ? [] : [id];
    if (typeof participant.name !== 'string' || participant.name.trim().length === 0) {
      issues.push({ code: 'EMPTY_NAME', message: 'Uczestnik wymaga imienia.', participantIds: affected });
    }
    if (typeof participant.animal !== 'string' || participant.animal.trim().length === 0) {
      issues.push({ code: 'EMPTY_ANIMAL', message: 'Uczestnik wymaga zwierzątka.', participantIds: affected });
    } else {
      const animal = participant.animal.trim().toLowerCase();
      const previous = animalOwners.get(animal);
      if (previous !== undefined) {
        issues.push({ code: 'DUPLICATE_ANIMAL', message: 'Zwierzątka muszą być unikalne.', participantIds: id === undefined ? [previous] : [previous, id] });
      } else if (id !== undefined) {
        animalOwners.set(animal, id);
      }
    }
  }

  for (const rule of rules) {
    if (!rule || !isParticipantId(rule.giverId) || !isParticipantId(rule.receiverId) || !isRuleReason(rule.reason)) {
      issues.push({ code: 'INVALID_RULE', message: 'Nieprawidłowa reguła losowania.', participantIds: [] });
      continue;
    }
    if (!ids.has(rule.giverId) || !ids.has(rule.receiverId)) {
      issues.push({ code: 'UNKNOWN_PARTICIPANT', message: 'Reguła wskazuje nieznanego uczestnika.', participantIds: [rule.giverId, rule.receiverId] });
    }
    if (rule.giverId === rule.receiverId) {
      issues.push({ code: 'SELF_RULE', message: 'Nie można dodać zakazu do tej samej osoby.', participantIds: [rule.giverId] });
    }
  }

  return issues;
}

export function validateSetup(participants: readonly Participant[], rules: readonly Rule[]): SetupValidation {
  const errors = collectDataIssues(participants, rules);
  const warnings: ValidationIssue[] = [];

  if (participants.length < MIN_PARTICIPANTS || participants.length > MAX_PARTICIPANTS) {
    errors.push({ code: 'PARTICIPANT_COUNT', message: 'Wydarzenie wymaga od 7 do 12 uczestników.', participantIds: [] });
  }

  if (errors.length === 0) {
    const graph = buildGraph(participants, rules);
    const ids = participants.map((participant) => participant.id);
    if (!hasPerfectMatching(graph, ids, ids)) {
      errors.push({ code: 'NO_PERFECT_MATCHING', message: 'Reguły są sprzeczne, poluzuj zakazy.', participantIds: [] });
    }
    for (const participant of participants) {
      if (graph.get(participant.id)?.length === 1) {
        warnings.push({ code: 'SINGLE_OPTION', message: 'Uczestnik ma tylko jedną możliwą opcję.', participantIds: [participant.id] });
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}