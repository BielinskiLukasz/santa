// Pure layout for the clearing (ART-SPEC §5): SVG grid 1920×1080, two rows of animals
// around the campfire at (960, ~650). Back row is higher and smaller, front row lower
// and bigger; animals spread evenly and symmetrically around the fire.

export interface AnimalSlot {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly row: 'back' | 'front';
}

export const SCENE_WIDTH = 1920;
export const SCENE_HEIGHT = 1080;
export const FIRE_POSITION = { x: 960, y: 655 } as const;

const BACK_ROW = { y: 592, scale: 0.85 } as const;
const FRONT_ROW = { y: 762, scale: 1 } as const;
const MAX_PER_ROW = 6;
const SLOT_SPACING = 232;

function rowSlots(count: number, row: 'back' | 'front'): AnimalSlot[] {
  if (count <= 0) return [];
  const { y, scale } = row === 'back' ? BACK_ROW : FRONT_ROW;
  if (count === 1) return [{ x: FIRE_POSITION.x, y, scale, row }];
  const span = Math.min(SLOT_SPACING * (count - 1), 1400);
  const start = FIRE_POSITION.x - span / 2;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, index) => ({
    x: Math.round(start + step * index),
    y,
    scale,
    row,
  }));
}

export function layout(count: number): AnimalSlot[] {
  const clamped = Math.max(0, Math.min(12, Math.floor(count)));
  const backCount = Math.min(MAX_PER_ROW, Math.floor(clamped / 2));
  const frontCount = Math.min(MAX_PER_ROW, clamped - backCount);
  return [...rowSlots(backCount, 'back'), ...rowSlots(frontCount, 'front')];
}
