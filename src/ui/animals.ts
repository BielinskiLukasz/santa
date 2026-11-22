export interface AnimalInfo {
  readonly id: string;
  readonly name: string;
  // Fur colour used by the placeholder disc until the phase-4 drawings arrive.
  readonly fur: string;
}

// Species from ART-SPEC §3 (ported from child-train); drawings arrive in phase 4.
export const ANIMALS: readonly AnimalInfo[] = [
  { id: 'kroliczek', name: 'Króliczek', fur: '#ddd7c4' },
  { id: 'lisek', name: 'Lisek', fur: '#c47b58' },
  { id: 'mis', name: 'Miś', fur: '#b99272' },
  { id: 'jezyk', name: 'Jeżyk', fur: '#9c7155' },
  { id: 'sowka', name: 'Sówka', fur: '#8d9bb8' },
  { id: 'wiewiorka', name: 'Wiewiórka', fur: '#b96f52' },
  { id: 'kotek', name: 'Kotek', fur: '#a6b4c8' },
  { id: 'piesek', name: 'Piesek', fur: '#c98a7a' },
  { id: 'zabka', name: 'Żabka', fur: '#7c8f6f' },
  { id: 'borsuk', name: 'Borsuk', fur: '#6f7fa3' },
  { id: 'jelonek', name: 'Jelonek', fur: '#a67b58' },
  { id: 'myszka', name: 'Myszka', fur: '#b7c4ce' },
  { id: 'kaczuszka', name: 'Kaczuszka', fur: '#f2c978' },
  { id: 'owieczka', name: 'Owieczka', fur: '#f5eedb' },
  { id: 'prosiaczek', name: 'Prosiaczek', fur: '#dcb9a8' },
  { id: 'zolwik', name: 'Żółwik', fur: '#777c58' },
];

const BY_ID = new Map(ANIMALS.map((animal) => [animal.id, animal]));

export function animalInfo(id: string): AnimalInfo {
  return BY_ID.get(id) ?? { id, name: id, fur: '#8d9bb8' };
}

export function animalName(id: string): string {
  return animalInfo(id).name;
}
