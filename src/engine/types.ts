/** Czyste typy domenowe silnika. Zero zależności od UI, bazy czy Firebase. */
export type Participant = { id: string; name: string };

/** Zakaz skierowany: [A, B] blokuje wyłącznie A → B. */
export type Constraint = [from: string, to: string];

export type DrawState = {
  participants: Participant[];
  constraints: Constraint[];
  /** id odbiorców, którzy zostali już wylosowani */
  takenReceivers: string[];
  /** id osób, które mają już wynik (własny lub dolosowany) */
  drawnGivers: string[];
  seed: string;
};

export type Assignment = { giver: string; receiver: string };

/** Opcja z wagą = liczba poprawnych dopełnień po wyborze tej opcji. */
export type Option = { receiver: string; weight: number };

export type Choice = {
  chooser: string;
  options: Option[];
  pick: string | null;
  /** Wszystkie przypisania do zapisania w jednym atomowym commicie. */
  assignments: Assignment[];
  /** Wyniki wyznaczone jednoznacznie (nie były losowane). */
  forcedTail: Assignment[];
  forced: boolean;
  rngValue: number;
};

export type DrawStep = {
  giver: string;
  options: string[];
  chosen: string;
  forcedTail: number;
  rngValue: number;
};

export type FullDraw = { assignments: Assignment[]; steps: DrawStep[] };

export type ValidationResult = {
  ok: boolean;
  solutions: number;
  error: string | null;
};
