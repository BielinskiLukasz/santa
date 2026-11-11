import { buildAllowedMatrix, countCompletions, indexMaps } from "./matrix";
import { popCount, rngFor } from "./prng";
import type {
  Assignment,
  Choice,
  Constraint,
  DrawState,
  FullDraw,
  Option,
  Participant,
  ValidationResult,
} from "./types";

function takenMaskOf(state: DrawState): number {
  const { byId } = indexMaps(state.participants);
  let mask = 0;
  for (const id of state.takenReceivers) {
    const i = byId.get(id);
    if (i !== undefined) mask |= 1 << i;
  }
  return mask;
}

function remainingGivers(state: DrawState, chooser: string): number[] {
  const { byId } = indexMaps(state.participants);
  const drawn = new Set(state.drawnGivers);
  const result: number[] = [];
  state.participants.forEach((p, i) => {
    if (p.id !== chooser && !drawn.has(p.id)) result.push(i);
  });
  return result;
}

/** Liczba wszystkich poprawnych przypisań dla świeżego losowania. */
export function countSolutions(
  participants: Participant[],
  constraints: Constraint[],
  takenReceivers: string[] = [],
  drawnGivers: string[] = [],
): number {
  if (participants.length === 0) return 0;
  const allowed = buildAllowedMatrix(participants, constraints);
  const { byId } = indexMaps(participants);
  let mask = 0;
  for (const id of takenReceivers) {
    const i = byId.get(id);
    if (i !== undefined) mask |= 1 << i;
  }
  const drawn = new Set(drawnGivers);
  const givers = participants
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !drawn.has(p.id))
    .map(({ i }) => i);
  return countCompletions(allowed, givers, mask);
}

/** Opcje dostępne dla wybierającego: tylko te z co najmniej jednym dopełnieniem. */
export function getAvailableOptions(state: DrawState, chooser: string): Option[] {
  const { byId, byIndex } = indexMaps(state.participants);
  const chooserIndex = byId.get(chooser);
  if (chooserIndex === undefined) return [];
  if (state.drawnGivers.includes(chooser)) return [];

  const allowed = buildAllowedMatrix(state.participants, state.constraints);
  const mask = takenMaskOf(state);
  const givers = remainingGivers(state, chooser);
  const options: Option[] = [];
  for (let j = 0; j < byIndex.length; j += 1) {
    if (mask & (1 << j)) continue;
    if (!allowed[chooserIndex][j]) continue;
    const weight = countCompletions(allowed, givers, mask | (1 << j));
    if (weight > 0) options.push({ receiver: byIndex[j], weight });
  }
  return options;
}

/** Losowanie ważone liczbą dopełnień ⇒ rozkład jednostajny po poprawnych przypisaniach. */
export function pickWeighted(
  options: Option[],
  rng: number | (() => number) = Math.random,
): Option {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  if (total <= 0) throw new Error("Brak dostępnych opcji do losowania");
  const value = typeof rng === "function" ? rng() : rng;
  let acc = value * total;
  for (const option of options) {
    acc -= option.weight;
    if (acc < 0) return option;
  }
  return options[options.length - 1];
}

/**
 * Gdy po wyborze zostaje dokładnie jedno dopełnienie, reszta jest wyznaczona
 * jednoznacznie – „dolosowujemy" ją bez dodatkowego losowania.
 */
export function resolveForcedTail(
  state: DrawState,
  chooser: string,
  pickedReceiver: string,
): Assignment[] {
  const { byId, byIndex } = indexMaps(state.participants);
  const allowed = buildAllowedMatrix(state.participants, state.constraints);
  const picked = byId.get(pickedReceiver);
  if (picked === undefined) throw new Error("Nieznany odbiorca");
  let mask = takenMaskOf(state) | (1 << picked);
  const givers = remainingGivers(state, chooser);
  const result: Assignment[] = [];
  const n = byIndex.length;

  for (let pos = 0; pos < givers.length; pos += 1) {
    const giverIndex = givers[pos];
    let found = -1;
    for (let j = 0; j < n; j += 1) {
      if (mask & (1 << j)) continue;
      if (!allowed[giverIndex][j]) continue;
      const completions = countCompletions(
        allowed,
        givers.slice(pos + 1),
        mask | (1 << j),
      );
      if (completions > 0) {
        found = j;
        break;
      }
    }
    if (found < 0) throw new Error("Brak jednoznacznego dopełnienia");
    mask |= 1 << found;
    result.push({ giver: byIndex[giverIndex], receiver: byIndex[found] });
  }
  return result;
}

/** Pojedynczy krok losowania (używany przez pojedynczego uczestnika). */
export function computeChoice(
  state: DrawState,
  chooser: string,
  rng: () => number = rngFor(state.seed, chooser, state.drawnGivers.length),
): Choice {
  const options = getAvailableOptions(state, chooser);
  const rngValue = rng();
  if (options.length === 0) {
    return {
      chooser,
      options,
      pick: null,
      assignments: [],
      forcedTail: [],
      forced: false,
      rngValue,
    };
  }
  const picked = pickWeighted(options, rngValue);
  const forcedTail =
    picked.weight === 1
      ? resolveForcedTail(state, chooser, picked.receiver)
      : [];
  return {
    chooser,
    options,
    pick: picked.receiver,
    assignments: [
      { giver: chooser, receiver: picked.receiver },
      ...forcedTail,
    ],
    forcedTail,
    forced: forcedTail.length > 0,
    rngValue,
  };
}

/** Tryb „admin losuje wszystko naraz": ten sam silnik, jeden strumień PRNG. */
export function runFullDraw(
  state: DrawState,
  rng: () => number = rngFor(state.seed, "all"),
): FullDraw {
  const current: DrawState = {
    ...state,
    takenReceivers: [...state.takenReceivers],
    drawnGivers: [...state.drawnGivers],
  };
  const assignments: Assignment[] = [];
  const steps: FullDraw["steps"] = [];
  const drawn = new Set(current.drawnGivers);

  for (const participant of current.participants) {
    if (drawn.has(participant.id)) continue;
    const choice = computeChoice(current, participant.id, rng);
    if (!choice.pick) {
      throw new Error(`Brak dostępnej opcji dla ${participant.id}`);
    }
    steps.push({
      giver: participant.id,
      options: choice.options.map((o) => o.receiver),
      chosen: choice.pick,
      forcedTail: choice.forcedTail.length,
      rngValue: choice.rngValue,
    });
    for (const assignment of choice.assignments) {
      assignments.push(assignment);
      current.takenReceivers.push(assignment.receiver);
      current.drawnGivers.push(assignment.giver);
      drawn.add(assignment.giver);
    }
  }
  return { assignments, steps };
}

/** Walidacja wejścia już przy tworzeniu losowania. */
export function validateDrawInput(
  participants: Participant[],
  constraints: Constraint[],
): ValidationResult {
  if (participants.length < 2 || participants.length > 10) {
    return { ok: false, solutions: 0, error: "Wymagane są od 2 do 10 osób." };
  }
  const ids = new Set(participants.map((p) => p.id));
  if (ids.size !== participants.length) {
    return { ok: false, solutions: 0, error: "Identyfikatory osób muszą być unikalne." };
  }
  if (participants.some((p) => !p.name.trim())) {
    return { ok: false, solutions: 0, error: "Każda osoba musi mieć imię." };
  }
  for (const [from, to] of constraints) {
    if (!ids.has(from) || !ids.has(to)) {
      return { ok: false, solutions: 0, error: "Zakaz wskazuje na nieznaną osobę." };
    }
  }
  const solutions = countSolutions(participants, constraints);
  if (solutions === 0) {
    return {
      ok: false,
      solutions: 0,
      error: "Dla tych zakazów nie istnieje żadne poprawne losowanie. Usuń część zakazów.",
    };
  }
  return { ok: true, solutions, error: null };
}
