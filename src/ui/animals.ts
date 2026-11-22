import { ALL_ANIMALS, FUR_COLORS } from '../scene/animals';
import type { AnimalKind } from '../scene/animals';

export interface AnimalInfo {
  readonly id: string;
  readonly name: string;
  // Fur colour from the scene registry (ART-SPEC §2), kept for colour-coded UI accents.
  readonly fur: string;
}

// The species registry lives in src/scene/animals (ART-SPEC §3); this module keeps the
// flat catalogue shape used by the configuration forms.
export const ANIMALS: readonly AnimalInfo[] = ALL_ANIMALS.map((animal) => ({
  id: animal.id,
  name: animal.name,
  fur: FUR_COLORS[animal.id],
}));

const BY_ID = new Map(ANIMALS.map((animal) => [animal.id, animal]));

export function animalInfo(id: string): AnimalInfo {
  return BY_ID.get(id) ?? { id, name: id, fur: '#8d9bb8' };
}

export function animalName(id: string): string {
  return animalInfo(id).name;
}

export type { AnimalKind };
