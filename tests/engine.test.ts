import { describe, expect, it } from "vitest";
import {
  buildAllowedMatrix,
  computeChoice,
  countSolutions,
  getAvailableOptions,
  hashString,
  mulberry32,
  runFullDraw,
  validateDrawInput,
} from "../src/engine";
import type { Constraint, DrawState, Participant } from "../src/engine";

const people = (...names: string[]): Participant[] =>
  names.map((name, i) => ({ id: `p${i + 1}`, name }));

const state = (
  participants: Participant[],
  constraints: Constraint[] = [],
  seed = "seed-1",
): DrawState => ({
  participants,
  constraints,
  takenReceivers: [],
  drawnGivers: [],
  seed,
});

describe("macierz dozwolonych par", () => {
  it("blokuje samodzielne obdarowanie i tylko skierowany zakaz", () => {
    const p = people("A", "B", "C");
    const m = buildAllowedMatrix(p, [["p1", "p2"]]);
    expect(m[0][0]).toBe(false);
    expect(m[0][1]).toBe(false);
    expect(m[1][0]).toBe(true); // A→B nie blokuje B→A
    expect(m[1][2]).toBe(true);
  });
});

describe("zliczanie dopełnień i walidacja", () => {
  it("wykrywa brak jakiegokolwiek rozwiązania", () => {
    const p = people("A", "B", "C");
    // A nie może B ani C; B nie może A; C nie może A => brak cyklu
    const c: Constraint[] = [
      ["p1", "p2"],
      ["p1", "p3"],
      ["p2", "p1"],
      ["p3", "p1"],
    ];
    expect(countSolutions(p, c)).toBe(0);
    expect(validateDrawInput(p, c).ok).toBe(false);
  });

  it("wykrywa dokładnie jedno rozwiązanie i dolosowuje ogon", () => {
    const p = people("A", "B", "C");
    const c: Constraint[] = [
      ["p1", "p3"],
      ["p2", "p1"],
      ["p3", "p2"],
    ];
    expect(countSolutions(p, c)).toBe(1);
    const choice = computeChoice(state(p, c), "p1");
    expect(choice.pick).toBe("p2");
    expect(choice.forcedTail).toEqual([
      { giver: "p2", receiver: "p3" },
      { giver: "p3", receiver: "p1" },
    ]);
    expect(choice.assignments).toHaveLength(3);
  });

  it("przypadek brzegowy: 2 osoby mają jedno rozwiązanie", () => {
    const p = people("A", "B");
    expect(countSolutions(p, [])).toBe(1);
    const result = runFullDraw(state(p, []));
    expect(result.assignments).toEqual([
      { giver: "p1", receiver: "p2" },
      { giver: "p2", receiver: "p1" },
    ]);
  });

  it("przypadek brzegowy: 3 osoby mają 2 rozwiązania", () => {
    const p = people("A", "B", "C");
    expect(countSolutions(p, [])).toBe(2);
    expect(validateDrawInput(p, []).solutions).toBe(2);
  });

  it("zakaz skierowany nie blokuje przeciwnej pary", () => {
    const p = people("A", "B", "C");
    expect(countSolutions(p, [["p1", "p2"]])).toBe(1);
    const result = runFullDraw(state(p, [["p1", "p2"]]));
    expect(result.assignments).toContainEqual({ giver: "p2", receiver: "p1" });
    expect(result.assignments).not.toContainEqual({ giver: "p1", receiver: "p2" });
    expect(result.assignments[0]).toEqual({ giver: "p1", receiver: "p3" });
  });

  it("odrzuca nieprawidłową liczbę osób", () => {
    expect(validateDrawInput(people("A"), []).ok).toBe(false);
    expect(validateDrawInput(people(...Array(11).fill("A")), []).ok).toBe(false);
  });

  it("opcje z zerową liczbą dopełnień nie są dostępne", () => {
    const p = people("A", "B", "C");
    const options = getAvailableOptions(state(p, []), "p1");
    expect(options.map((o) => o.receiver)).toEqual(["p2", "p3"]);
  });
});

describe("sekwencyjny przebieg i dolosowanie", () => {
  it("każda osoba losuje po kolei, aż wszyscy mają wynik", () => {
    const p = people("A", "B", "C", "D", "E");
    let current = state(p, [["p1", "p2"]], "christmas");
    const all: { giver: string; receiver: string }[] = [];
    let guard = 0;
    while (current.drawnGivers.length < p.length && guard < 10) {
      guard += 1;
      const chooser = p.find((x) => !current.drawnGivers.includes(x.id))!.id;
      const choice = computeChoice(current, chooser);
      expect(choice.pick).not.toBeNull();
      all.push(...choice.assignments);
      current = {
        ...current,
        takenReceivers: [...current.takenReceivers, ...choice.assignments.map((a) => a.receiver)],
        drawnGivers: [...current.drawnGivers, ...choice.assignments.map((a) => a.giver)],
      };
    }
    expect(new Set(all.map((a) => a.giver)).size).toBe(5);
    expect(new Set(all.map((a) => a.receiver)).size).toBe(5);
    expect(all.every((a) => a.giver !== a.receiver)).toBe(true);
    expect(all.some((a) => a.giver === "p1" && a.receiver === "p2")).toBe(false);
  });

  it("po utracie części stanu nie dopuszcza do kolizji odbiorcy", () => {
    const p = people("A", "B", "C", "D");
    const current: DrawState = {
      ...state(p, []),
      takenReceivers: ["p2"],
      drawnGivers: ["p1"],
    };
    const options = getAvailableOptions(current, "p2");
    expect(options.some((o) => o.receiver === "p2")).toBe(false);
    expect(countSolutions(p, [], ["p2"], ["p1"])).toBeGreaterThan(0);
  });
});

describe("PRNG i rozkład", () => {
  it("ten sam seed daje ten sam wynik", () => {
    const p = people("A", "B", "C", "D", "E");
    const a = runFullDraw(state(p, [], "identyczny"));
    const b = runFullDraw(state(p, [], "identyczny"));
    expect(a).toEqual(b);
    expect(mulberry32(hashString("x"))()).toBe(mulberry32(hashString("x"))());
  });

  it("różne seedy dają różne przebiegi", () => {
    const p = people("A", "B", "C", "D");
    const results = new Set(
      Array.from({ length: 30 }, (_, i) =>
        JSON.stringify(runFullDraw(state(p, [], `s${i}`)).assignments),
      ),
    );
    expect(results.size).toBeGreaterThan(3);
  });

  it("rozkład jest zbliżony do jednostajnego po poprawnych przypisaniach", () => {
    const p = people("A", "B", "C", "D");
    const runs = 4500;
    const counts = new Map<string, number>();
    for (let i = 0; i < runs; i += 1) {
      const key = runFullDraw(state(p, [], `stat-${i}`))
        .assignments.map((a) => `${a.giver}:${a.receiver}`)
        .join(",");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(9); // !4 = 9 derangementów
    const expected = runs / 9;
    for (const count of counts.values()) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.2);
    }
  });

  it("pełny przebieg generuje tyle kroków, ile było losowań", () => {
    const p = people("A", "B", "C", "D", "E");
    const result = runFullDraw(state(p, [], "steps"));
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.length).toBeLessThanOrEqual(5);
    expect(result.assignments).toHaveLength(5);
  });
});
