// Pure helpers for the drawing ceremony (PHASE-5): who may still draw and how the
// selection moves around the circle. The ceremony itself only reacts to these.

export interface CeremonyParticipant {
  readonly id: string;
}

export function undrawnIds(
  participants: readonly CeremonyParticipant[],
  drawnIds: ReadonlySet<string>,
): string[] {
  return participants.filter((person) => !drawnIds.has(person.id)).map((person) => person.id);
}

// Moves the selection to the next participant who has not drawn yet, wrapping around
// the circle. From no selection it picks the first (or last) undrawn participant.
export function cycleUndrawn(
  participants: readonly CeremonyParticipant[],
  drawnIds: ReadonlySet<string>,
  currentId: string | null,
  direction: 1 | -1 = 1,
): string | null {
  const remaining = undrawnIds(participants, drawnIds);
  if (remaining.length === 0) return null;
  if (currentId === null) {
    return direction === 1 ? (remaining[0] as string) : (remaining[remaining.length - 1] as string);
  }
  const order = participants.map((person) => person.id);
  const start = order.indexOf(currentId);
  if (start === -1) return remaining[0] as string;
  for (let step = 1; step <= order.length; step += 1) {
    const candidate = order[(start + direction * step + order.length * step) % order.length] as string;
    if (!drawnIds.has(candidate)) return candidate;
  }
  return null;
}

export interface CeremonyTiming {
  readonly walkMs: number;
  readonly envelopeMs: number;
  readonly returnMs: number;
}

// Minimal ceremony timing (PHASE-5 risk note: movement polish arrives in phase 6).
// Reduced-motion users get near-instant transitions instead of the walk.
export function ceremonyTiming(reducedMotion: boolean): CeremonyTiming {
  if (reducedMotion) return { walkMs: 120, envelopeMs: 120, returnMs: 120 };
  return { walkMs: 1600, envelopeMs: 1150, returnMs: 1200 };
}
