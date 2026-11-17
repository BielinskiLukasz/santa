import { describe, expect, it } from 'vitest';
import { validateBudget, validateSetup } from '../../../src/engine';
import type { Rule } from '../../../src/engine';
import { makeParticipants } from './fixtures';

describe('Walidacja konfiguracji', () => {
  it('akceptuje wydarzenie od 7 do 12 uczestników', () => {
    expect(validateSetup(makeParticipants(7), [])).toEqual({ ok: true, errors: [], warnings: [] });
    expect(validateSetup(makeParticipants(12), []).ok).toBe(true);
    expect(validateSetup(makeParticipants(6), []).errors.map((issue) => issue.code)).toContain('PARTICIPANT_COUNT');
    expect(validateSetup(makeParticipants(13), []).errors.map((issue) => issue.code)).toContain('PARTICIPANT_COUNT');
  });

  it('odrzuca pustą listę, duplikaty identyfikatorów i zwierzątek', () => {
    expect(validateSetup([], []).errors.map((issue) => issue.code)).toContain('EMPTY_PARTICIPANTS');
    const duplicateIds = makeParticipants(7).map((person, index) => index === 1 ? { ...person, id: 'p0' } : person);
    expect(validateSetup(duplicateIds, []).errors.map((issue) => issue.code)).toContain('DUPLICATE_PARTICIPANT_ID');
    const duplicateAnimals = makeParticipants(7).map((person, index) => index === 1 ? { ...person, animal: ' ANIMAL-0 ' } : person);
    const issues = validateSetup(duplicateAnimals, []).errors;
    expect(issues).toContainEqual(expect.objectContaining({ code: 'DUPLICATE_ANIMAL', participantIds: ['p0', 'p1'] }));
  });

  it('odrzuca puste imię lub zwierzątko i niepoprawne reguły', () => {
    const people = makeParticipants(7).map((person, index) => index === 1 ? { ...person, name: ' ', animal: '' } : person);
    const rules: Rule[] = [
      { giverId: 'p0', receiverId: 'p0', reason: 'MANUAL' },
      { giverId: 'p0', receiverId: 'missing', reason: 'MANUAL' },
    ];
    const codes = validateSetup(people, rules).errors.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['EMPTY_NAME', 'EMPTY_ANIMAL', 'SELF_RULE', 'UNKNOWN_PARTICIPANT']));
  });

  it('odrzuca puste identyfikatory i nieznane powody zakazu', () => {
    const people = makeParticipants(7).map((person, index) => index === 1 ? { ...person, id: ' ' } : person);
    const invalidRule = { giverId: 'p0', receiverId: 'p2', reason: 'OTHER' } as unknown as Rule;
    const codes = validateSetup(people, [invalidRule]).errors.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(['INVALID_PARTICIPANT_ID', 'INVALID_RULE']));
  });

  it('blokuje sprzeczne reguły', () => {
    const people = makeParticipants(7);
    const rules: Rule[] = people.slice(1).map((person) => ({ giverId: 'p0', receiverId: person.id, reason: 'MANUAL' }));
    const result = validateSetup(people, rules);
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: 'NO_PERFECT_MATCHING',
      message: 'Reguły są sprzeczne, poluzuj zakazy.',
    }));
  });

  it('wykrywa konflikt, mimo że każda osoba ma dostępne opcje', () => {
    const people = makeParticipants(7);
    const rules: Rule[] = [];
    for (const giverId of ['p0', 'p1', 'p2']) {
      for (const person of people) {
        if (person.id !== giverId && person.id !== 'p3' && person.id !== 'p4') {
          rules.push({ giverId, receiverId: person.id, reason: 'MANUAL' });
        }
      }
    }
    const result = validateSetup(people, rules);
    expect(result.ok).toBe(false);
    expect(result.errors.map((issue) => issue.code)).toContain('NO_PERFECT_MATCHING');
  });

  it('ostrzega o jednej opcji bez blokowania rozwiązywalnej konfiguracji', () => {
    const people = makeParticipants(7);
    const rules: Rule[] = people.slice(2).map((person) => ({ giverId: 'p0', receiverId: person.id, reason: 'MANUAL' }));
    const result = validateSetup(people, rules);
    expect(result.ok).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'SINGLE_OPTION', participantIds: ['p0'] }));
  });
});

describe('Walidacja budżetu', () => {
  it.each([10, 101, 2000])('zachowuje poprawną kwotę %i bez zaokrąglania', (amount) => {
    expect(validateBudget(amount)).toEqual({ ok: true, value: amount });
  });

  it.each([undefined, null, '', '100', NaN, Infinity, 10.5])('odrzuca niepoprawną wartość %s', (amount) => {
    expect(validateBudget(amount)).toEqual({ ok: false, code: 'INVALID_AMOUNT' });
  });

  it('odrzuca wartości poza zakresem i respektuje własny zakres', () => {
    expect(validateBudget(9)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(validateBudget(2001)).toEqual({ ok: false, code: 'OUT_OF_RANGE' });
    expect(validateBudget(25, { min: 20, max: 30 })).toEqual({ ok: true, value: 25 });
    expect(validateBudget(0, { min: 0, max: 30 })).toEqual({ ok: true, value: 0 });
    expect(validateBudget(10, { min: 20, max: 10 })).toEqual({ ok: false, code: 'INVALID_RANGE' });
    expect(validateBudget(10, { min: -1, max: 10 })).toEqual({ ok: false, code: 'INVALID_RANGE' });
  });
});