import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../src/engine';
import type { Participant } from '../../../src/engine';
import { ANIMALS } from '../../../src/ui/animals';
import type { ConfigDraft } from '../../../src/ui/draft';
import {
  assignAnimals,
  draftFromState,
  participantCountOk,
  toConfiguration,
  validateDraft,
  withoutParticipant,
} from '../../../src/ui/draft';
import { configuration } from '../state/fixtures';
import { createInitialState, reduceAppState } from '../../../src/state';

function participants(count: number, withAnimals = true): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    name: `Osoba ${index}`,
    animal: withAnimals ? (ANIMALS[index % ANIMALS.length]?.id ?? '') : '',
  }));
}

function draft(count = 7): ConfigDraft {
  return {
    participants: participants(count),
    couples: [],
    previousDraws: [],
    manualRestrictions: [],
    currency: 'PLN',
    budgetMin: 10,
    budgetMax: 2000,
    adminPreviewEnabled: false,
  };
}

describe('Szkic konfiguracji', () => {
  it('odtwarza szkic ze stanu i zapisuje go z powrotem bez zmian', () => {
    let state = createInitialState(2026);
    state = reduceAppState(state, { type: 'CONFIGURE', configuration: configuration() });
    const restored = draftFromState(state);
    expect(toConfiguration(restored)).toEqual(configuration());
    expect(validateDraft(restored).ok).toBe(true);
  });

  it('wykrywa zduplikowane zwierzątka', () => {
    const value = draft();
    const first = value.participants[0];
    const second = value.participants[1];
    if (!first || !second) throw new Error('Brak uczestników testowych.');
    value.participants[1] = { ...second, animal: first.animal };
    const validation = validateDraft(value);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((issue) => issue.code === 'DUPLICATE_ANIMAL')).toBe(true);
  });

  it('odrzuca 6 i 13 uczestników, akceptuje od 7 do 12', () => {
    expect(participantCountOk(draft(6))).toBe(false);
    expect(validateDraft(draft(6)).errors.some((issue) => issue.code === 'PARTICIPANT_COUNT')).toBe(true);
    expect(validateDraft(draft(7)).ok).toBe(true);
    expect(validateDraft(draft(12)).ok).toBe(true);
    expect(validateDraft(draft(13)).errors.some((issue) => issue.code === 'PARTICIPANT_COUNT')).toBe(true);
  });

  it('blokuje zatwierdzenie przy sprzecznych regułach', () => {
    const value = draft(7);
    // p0 cannot draw anyone: the couple excludes p1, manual rules exclude everyone else.
    value.couples = [{ firstId: 'p0', secondId: 'p1' }];
    value.manualRestrictions = ['p2', 'p3', 'p4', 'p5', 'p6'].map((receiverId) => ({
      giverId: 'p0',
      receiverId,
    }));
    const validation = validateDraft(value);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((issue) => issue.code === 'NO_PERFECT_MATCHING')).toBe(true);
  });

  it('zgłasza zduplikowaną parę i złamaną permutację zeszłego roku', () => {
    const value = draft();
    value.couples = [
      { firstId: 'p0', secondId: 'p1' },
      { firstId: 'p1', secondId: 'p0' },
    ];
    value.previousDraws = [
      { giverId: 'p0', receiverId: 'p1' },
      { giverId: 'p0', receiverId: 'p2' },
    ];
    const validation = validateDraft(value);
    expect(validation.ok).toBe(false);
    expect(validation.problems.some((problem) => problem.includes('para jest już'))).toBe(true);
    expect(validation.problems.some((problem) => problem.startsWith('Zeszły rok'))).toBe(true);
  });

  it('zgłasza nieprawidłowy zakres budżetu', () => {
    const value = draft();
    value.budgetMin = 500;
    value.budgetMax = 100;
    const validation = validateDraft(value);
    expect(validation.rangeInvalid).toBe(true);
    expect(validation.ok).toBe(false);
  });

  it('losuje unikalne zwierzęta i zachowuje ręcznie wybrane', () => {
    const value = draft(9);
    value.participants = participants(9, false);
    const manual = value.participants[0];
    if (!manual) throw new Error('Brak uczestnika testowego.');
    value.participants[0] = { ...manual, animal: 'lisek' };
    const assigned = assignAnimals(value, createSeededRandom(7));
    const animals = assigned.participants.map((person) => person.animal);
    expect(assigned.participants[0]?.animal).toBe('lisek');
    expect(new Set(animals).size).toBe(animals.length);
    expect(animals.every((animal) => animal.length > 0)).toBe(true);
  });

  it('usuwa reguły po usuniętym uczestniku', () => {
    const value = draft();
    value.couples = [{ firstId: 'p0', secondId: 'p1' }];
    value.previousDraws = [{ giverId: 'p2', receiverId: 'p0' }];
    value.manualRestrictions = [{ giverId: 'p3', receiverId: 'p4' }];
    const pruned = withoutParticipant(value, 'p0');
    expect(pruned.participants).toHaveLength(6);
    expect(pruned.couples).toHaveLength(0);
    expect(pruned.previousDraws).toHaveLength(0);
    expect(pruned.manualRestrictions).toHaveLength(1);
  });
});
