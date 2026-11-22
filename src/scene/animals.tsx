import type { ReactNode } from 'react';

// Animal template recreated after `child-train` (ART-SPEC §3): one body plan for every
// species; a species is a silhouette layer + fur colour + one scarf colour. Fills only,
// soft round strokes where a line is itself an object (whiskers, antlers, envelope flap).

export const ANIMAL_KINDS = [
  'kroliczek',
  'lisek',
  'mis',
  'jezyk',
  'sowka',
  'wiewiorka',
  'kotek',
  'piesek',
  'zabka',
  'borsuk',
  'jelonek',
  'myszka',
  'kaczuszka',
  'owieczka',
  'prosiaczek',
  'zolwik',
] as const;

export type AnimalKind = (typeof ANIMAL_KINDS)[number];

export const ALL_ANIMALS: readonly { readonly id: AnimalKind; readonly name: string }[] = [
  { id: 'kroliczek', name: 'Króliczek' },
  { id: 'lisek', name: 'Lisek' },
  { id: 'mis', name: 'Miś' },
  { id: 'jezyk', name: 'Jeżyk' },
  { id: 'sowka', name: 'Sówka' },
  { id: 'wiewiorka', name: 'Wiewiórka' },
  { id: 'kotek', name: 'Kotek' },
  { id: 'piesek', name: 'Piesek' },
  { id: 'zabka', name: 'Żabka' },
  { id: 'borsuk', name: 'Borsuk' },
  { id: 'jelonek', name: 'Jelonek' },
  { id: 'myszka', name: 'Myszka' },
  { id: 'kaczuszka', name: 'Kaczuszka' },
  { id: 'owieczka', name: 'Owieczka' },
  { id: 'prosiaczek', name: 'Prosiaczek' },
  { id: 'zolwik', name: 'Żółwik' },
];

// Muted winter-evening furs (ART-SPEC §2), verified against the evening palette.
export const FUR_COLORS: Record<AnimalKind, string> = {
  kroliczek: '#ddd7c4',
  lisek: '#c47b58',
  mis: '#b99272',
  jezyk: '#9c7155',
  sowka: '#8d9bb8',
  wiewiorka: '#b96f52',
  kotek: '#a6b4c8',
  piesek: '#c98a7a',
  zabka: '#7c8f6f',
  borsuk: '#6f7fa3',
  jelonek: '#a67b58',
  myszka: '#b7c4ce',
  kaczuszka: '#f2c978',
  owieczka: '#f5eedb',
  prosiaczek: '#dcb9a8',
  zolwik: '#9aa578',
};

// Species whose face departs from the shared one (ART-SPEC §3).
export const CUSTOM_FACE: ReadonlySet<AnimalKind> = new Set(['sowka', 'kaczuszka', 'owieczka', 'zolwik']);

export type AnimalMood = 'cheerful' | 'curious' | 'dozing' | 'holding-envelope';

export const SCARF_COLORS = ['#b45a4a', '#3e5b4d', '#6f7fa3', '#c08552'] as const;

const KIND_SET = new Set<string>(ANIMAL_KINDS);

export function normalizeKind(id: string): AnimalKind {
  return KIND_SET.has(id) ? (id as AnimalKind) : 'mis';
}

export function shade(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (component: number) =>
    Math.max(0, Math.min(255, Math.round(component * factor)));
  const r = channel((value >> 16) & 0xff);
  const g = channel((value >> 8) & 0xff);
  const b = channel(value & 0xff);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Deterministic scarf colour for a seed (the child-train `scarfFor` idea).
export function scarfFor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 9973;
  }
  return SCARF_COLORS[hash % SCARF_COLORS.length] as string;
}

// Assigns scarves so neighbours in the circle always differ (including first/last).
export function resolveScarves(ids: readonly string[]): string[] {
  const result: string[] = [];
  ids.forEach((id, index) => {
    let color = scarfFor(id);
    const previous = result[index - 1];
    if (previous !== undefined && color === previous) {
      color = SCARF_COLORS.find((candidate) => candidate !== previous) as string;
    }
    if (index === ids.length - 1 && ids.length > 2 && color === result[0]) {
      const first = result[0] as string;
      color = SCARF_COLORS.find((candidate) => candidate !== previous && candidate !== first) ?? color;
    }
    result.push(color);
  });
  return result;
}

const INK = '#304b3e';
const NOSE = '#765348';
const CHEEK = '#cf9f89';
const CREAM = '#f8f5e8';

export function EnvelopeFigure({ sealed = true }: { sealed?: boolean }) {
  return (
    <g data-envelope={sealed ? 'sealed' : 'empty'}>
      <rect x={-27} y={-19} width={54} height={38} rx={5} fill={CREAM} />
      <path d="M-27 -19 L0 5 L27 -19" fill="none" stroke="#d9cfb2" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M-27 19 L-4 0 M27 19 L4 0" stroke="#e3dac0" strokeWidth={2} strokeLinecap="round" />
      {sealed ? (
        <>
          <circle cx={0} cy={3} r={7.5} fill="#b45a4a" />
          <circle cx={0} cy={3} r={3.4} fill="#c98a7a" />
        </>
      ) : null}
    </g>
  );
}

function silhouette(kind: AnimalKind, fur: string): ReactNode {
  const dark = shade(fur, 0.78);
  const darker = shade(fur, 0.62);
  switch (kind) {
    case 'kroliczek':
      return (
        <>
          <ellipse cx={45} cy={14} rx={8.5} ry={23} fill={fur} transform="rotate(-8 45 14)" />
          <ellipse cx={75} cy={14} rx={8.5} ry={23} fill={fur} transform="rotate(8 75 14)" />
          <ellipse cx={45} cy={16} rx={3.8} ry={15} fill={CHEEK} opacity={0.75} transform="rotate(-8 45 16)" />
          <ellipse cx={75} cy={16} rx={3.8} ry={15} fill={CHEEK} opacity={0.75} transform="rotate(8 75 16)" />
        </>
      );
    case 'lisek':
      return (
        <>
          <path d="M84 118 C104 108 108 84 96 66 C104 92 96 106 78 112 Z" fill={dark} />
          <path d="M92 82 C98 88 98 96 94 102 C90 94 90 88 92 82 Z" fill={CREAM} />
          <path d="M34 36 L40 6 Q41 2 45 5 L58 24 Q46 30 34 36 Z" fill={fur} />
          <path d="M86 36 L80 6 Q79 2 75 5 L62 24 Q74 30 86 36 Z" fill={fur} />
        </>
      );
    case 'mis':
      return (
        <>
          <circle cx={35} cy={30} r={11.5} fill={fur} />
          <circle cx={85} cy={30} r={11.5} fill={fur} />
          <circle cx={35} cy={30} r={5.5} fill={CHEEK} opacity={0.8} />
          <circle cx={85} cy={30} r={5.5} fill={CHEEK} opacity={0.8} />
        </>
      );
    case 'jezyk':
      return (
        <>
          <path
            d="M28 44 L22 30 L34 34 L34 18 L46 28 L54 12 L62 26 L74 14 L78 30 L90 24 L88 40 L98 40 L90 52 L98 60 L86 66 L90 78 L78 80 L78 92 L64 86 L56 98 L48 86 L34 92 L36 78 L24 76 L32 64 L22 56 Z"
            fill={darker}
          />
          <path d="M40 96 L34 82 L48 86 L54 74 L62 86 L76 80 L72 94 L80 104 L64 104 L58 114 L50 104 L36 108 Z" fill={darker} />
        </>
      );
    case 'sowka':
      return (
        <>
          <path d="M36 32 L32 14 L48 24 Z" fill={fur} />
          <path d="M84 32 L88 14 L72 24 Z" fill={fur} />
          <ellipse cx={60} cy={100} rx={17} ry={15} fill={CREAM} opacity={0.55} />
        </>
      );
    case 'wiewiorka':
      return (
        <>
          <path d="M82 120 C112 112 120 74 102 44 C118 82 108 106 78 112 Z" fill={dark} />
          <path d="M40 28 L44 16 L50 26 Z" fill={fur} />
          <path d="M80 28 L76 16 L70 26 Z" fill={fur} />
        </>
      );
    case 'kotek':
      return (
        <>
          <path d="M36 34 L38 10 Q39 6 43 9 L54 24 Q45 30 36 34 Z" fill={fur} />
          <path d="M84 34 L82 10 Q81 6 77 9 L66 24 Q75 30 84 34 Z" fill={fur} />
          <path d="M28 56 L14 52 M29 63 L15 63 M88 56 L102 52 M87 63 L101 63" stroke={INK} strokeWidth={1.8} strokeLinecap="round" opacity={0.45} />
        </>
      );
    case 'piesek':
      return (
        <>
          <ellipse cx={29} cy={54} rx={9.5} ry={21} fill={dark} transform="rotate(10 29 54)" />
          <ellipse cx={91} cy={54} rx={9.5} ry={21} fill={dark} transform="rotate(-10 91 54)" />
        </>
      );
    case 'zabka':
      return (
        <>
          <circle cx={43} cy={25} r={10.5} fill={fur} />
          <circle cx={77} cy={25} r={10.5} fill={fur} />
        </>
      );
    case 'borsuk':
      return (
        <>
          <circle cx={36} cy={31} r={10} fill={fur} />
          <circle cx={84} cy={31} r={10} fill={fur} />
          <path d="M51 21 Q60 15 69 21 L66 52 Q60 56 54 52 Z" fill={CREAM} />
        </>
      );
    case 'jelonek':
      return (
        <>
          <path
            d="M42 28 C36 18 34 10 36 2 M36 12 L28 6 M38 18 L30 16 M78 28 C84 18 86 10 84 2 M84 12 L92 6 M82 18 L90 16"
            stroke="#9c7155"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx={32} cy={44} rx={7} ry={11} fill={fur} transform="rotate(18 32 44)" />
          <ellipse cx={88} cy={44} rx={7} ry={11} fill={fur} transform="rotate(-18 88 44)" />
        </>
      );
    case 'myszka':
      return (
        <>
          <circle cx={33} cy={27} r={13.5} fill={fur} />
          <circle cx={87} cy={27} r={13.5} fill={fur} />
          <circle cx={33} cy={27} r={7} fill={CHEEK} opacity={0.85} />
          <circle cx={87} cy={27} r={7} fill={CHEEK} opacity={0.85} />
          <path d="M34 112 C18 112 10 102 12 92" fill="none" stroke={dark} strokeWidth={3.5} strokeLinecap="round" />
        </>
      );
    case 'kaczuszka':
      return (
        <>
          <ellipse cx={52} cy={17} rx={4} ry={8} fill={fur} transform="rotate(-14 52 17)" />
          <ellipse cx={61} cy={14} rx={4} ry={9} fill={fur} />
          <ellipse cx={70} cy={17} rx={4} ry={8} fill={fur} transform="rotate(14 70 17)" />
        </>
      );
    case 'owieczka':
      return (
        <>
          <circle cx={42} cy={24} r={10} fill={CREAM} />
          <circle cx={56} cy={17} r={11.5} fill={CREAM} />
          <circle cx={70} cy={18} r={10.5} fill={CREAM} />
          <circle cx={80} cy={27} r={8.5} fill={CREAM} />
          <circle cx={38} cy={33} r={8} fill={CREAM} />
        </>
      );
    case 'prosiaczek':
      return (
        <>
          <circle cx={37} cy={31} r={9.5} fill={fur} />
          <circle cx={83} cy={31} r={9.5} fill={fur} />
          <circle cx={37} cy={31} r={4.5} fill={shade(fur, 0.85)} />
          <circle cx={83} cy={31} r={4.5} fill={shade(fur, 0.85)} />
        </>
      );
    case 'zolwik':
      return null;
  }
}

function face(kind: AnimalKind, fur: string, mood: AnimalMood): ReactNode {
  const closed = mood === 'dozing';
  const eyes = closed ? (
    <>
      <path d="M44 49 Q49 53 54 49" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M66 49 Q71 53 76 49" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
    </>
  ) : (
    <>
      <ellipse cx={49} cy={48} rx={3.3} ry={4.4} fill={INK} />
      <ellipse cx={71} cy={48} rx={3.3} ry={4.4} fill={INK} />
      <circle cx={50.2} cy={46.4} r={1.1} fill="#ffffff" />
      <circle cx={72.2} cy={46.4} r={1.1} fill="#ffffff" />
    </>
  );

  if (CUSTOM_FACE.has(kind)) {
    switch (kind) {
      case 'sowka':
        return (
          <g data-face="custom">
            <circle cx={48} cy={48} r={10} fill={CREAM} />
            <circle cx={72} cy={48} r={10} fill={CREAM} />
            {closed ? (
              <>
                <path d="M42 48 Q48 52 54 48 M66 48 Q72 52 78 48" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx={48} cy={48} r={4.6} fill={INK} />
                <circle cx={72} cy={48} r={4.6} fill={INK} />
                <circle cx={49.6} cy={46.2} r={1.4} fill="#ffffff" />
                <circle cx={73.6} cy={46.2} r={1.4} fill="#ffffff" />
              </>
            )}
            <path d="M55 58 L65 58 L60 65 Z" fill="#d98a4a" />
          </g>
        );
      case 'kaczuszka':
        return (
          <g data-face="custom">
            {eyes}
            <ellipse cx={60} cy={60} rx={10.5} ry={6.5} fill="#d98a4a" />
            <path d="M52 60 Q60 63 68 60" fill="none" stroke="#b96f52" strokeWidth={2} strokeLinecap="round" />
            <circle cx={39} cy={59} r={5.5} fill={CHEEK} opacity={0.55} />
            <circle cx={81} cy={59} r={5.5} fill={CHEEK} opacity={0.55} />
          </g>
        );
      case 'owieczka':
        return (
          <g data-face="custom">
            <ellipse cx={60} cy={55} rx={19} ry={16} fill="#cbb59d" />
            {eyes}
            <ellipse cx={60} cy={59} rx={3.6} ry={2.7} fill={NOSE} />
            <path d="M55 64 Q60 68 65 64" fill="none" stroke={NOSE} strokeWidth={2.2} strokeLinecap="round" />
          </g>
        );
      case 'zolwik':
        return (
          <g data-face="custom">
            {eyes}
            <path d="M55 63 Q60 67 65 63" fill="none" stroke={NOSE} strokeWidth={2.2} strokeLinecap="round" />
            <circle cx={41} cy={59} r={5} fill={CHEEK} opacity={0.5} />
            <circle cx={79} cy={59} r={5} fill={CHEEK} opacity={0.5} />
          </g>
        );
      default:
        return null;
    }
  }

  if (kind === 'zabka') {
    // Frog eyes sit on the silhouette bumps; the smile stretches wider.
    return (
      <g data-face="common">
        {closed ? (
          <>
            <path d="M38 25 Q43 29 48 25 M72 25 Q77 29 82 25" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx={43} cy={24} r={4.4} fill={INK} />
            <circle cx={77} cy={24} r={4.4} fill={INK} />
            <circle cx={44.6} cy={22.2} r={1.3} fill="#ffffff" />
            <circle cx={78.6} cy={22.2} r={1.3} fill="#ffffff" />
          </>
        )}
        <circle cx={56} cy={52} r={1.4} fill={NOSE} />
        <circle cx={64} cy={52} r={1.4} fill={NOSE} />
        <path d="M46 60 Q60 70 74 60" fill="none" stroke={NOSE} strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={38} cy={58} r={5.5} fill={CHEEK} opacity={0.55} />
        <circle cx={82} cy={58} r={5.5} fill={CHEEK} opacity={0.55} />
      </g>
    );
  }

  return (
    <g data-face="common">
      {eyes}
      {kind === 'prosiaczek' ? (
        <>
          <ellipse cx={60} cy={58} rx={8.5} ry={6} fill={shade(fur, 0.92)} />
          <circle cx={57} cy={58} r={1.5} fill={NOSE} />
          <circle cx={63} cy={58} r={1.5} fill={NOSE} />
        </>
      ) : (
        <>
          <ellipse cx={60} cy={57} rx={4.2} ry={3.1} fill={NOSE} />
          <path d="M55 63 Q60 67 65 63" fill="none" stroke={NOSE} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
      <circle cx={39} cy={59} r={5.5} fill={CHEEK} opacity={0.55} />
      <circle cx={81} cy={59} r={5.5} fill={CHEEK} opacity={0.55} />
    </g>
  );
}

export function AnimalFigure({
  kind,
  scarf,
  mood = 'cheerful',
}: {
  kind: string;
  scarf: string;
  mood?: AnimalMood;
}) {
  const normalized = normalizeKind(kind);
  const fur = FUR_COLORS[normalized];
  const dark = shade(fur, 0.8);
  const headTilt = mood === 'curious' ? 'rotate(-6 60 78)' : mood === 'dozing' ? 'rotate(4 60 78)' : undefined;

  return (
    <g data-kind={normalized} data-mood={mood}>
      <ellipse cx={60} cy={124} rx={31} ry={6} fill="#29443c" opacity={0.28} />
      {silhouette(normalized, fur)}
      {normalized === 'zolwik' ? (
        <>
          <path d="M28 118 C28 84 42 68 60 68 C78 68 92 84 92 118 Q60 126 28 118 Z" fill="#777c58" />
          <path d="M40 112 C42 92 48 80 60 78 C72 80 78 92 80 112 Q60 118 40 112 Z" fill="#8b9168" />
          <circle cx={60} cy={46} r={21} fill={fur} />
          {face(normalized, fur, mood)}
        </>
      ) : (
        <>
          <ellipse cx={60} cy={97} rx={27} ry={25} fill={fur} />
          <ellipse cx={44} cy={121} rx={10.5} ry={6} fill={dark} />
          <ellipse cx={76} cy={121} rx={10.5} ry={6} fill={dark} />
          <g transform={headTilt}>
            <circle cx={60} cy={50} r={29} fill={fur} />
            {face(normalized, fur, mood)}
          </g>
        </>
      )}
      {/* Scarf: band plus a hanging tail, drawn over the neck. */}
      <rect x={35} y={73} width={50} height={13} rx={6.5} fill={scarf} />
      <path d="M76 84 L88 87 L83 108 L72 104 Z" fill={scarf} />
      <path d="M76 84 L88 87 L86 95 L74 92 Z" fill={shade(scarf, 0.85)} />
      {mood === 'holding-envelope' ? (
        <g data-testid="held-envelope">
          <g transform="translate(60 96)">
            <EnvelopeFigure />
          </g>
          <ellipse cx={36} cy={92} rx={8} ry={11} fill={dark} transform="rotate(18 36 92)" />
          <ellipse cx={84} cy={92} rx={8} ry={11} fill={dark} transform="rotate(-18 84 92)" />
        </g>
      ) : mood === 'cheerful' ? (
        <>
          <ellipse cx={31} cy={98} rx={8} ry={12} fill={dark} transform="rotate(14 31 98)" />
          <ellipse cx={93} cy={70} rx={8} ry={12.5} fill={dark} transform="rotate(-28 93 70)" />
        </>
      ) : (
        <>
          <ellipse cx={31} cy={98} rx={8} ry={12} fill={dark} transform="rotate(14 31 98)" />
          <ellipse cx={89} cy={98} rx={8} ry={12} fill={dark} transform="rotate(-14 89 98)" />
        </>
      )}
    </g>
  );
}

// Round avatar (head + scarf) used in lists and pickers as the animal thumbnail.
export function AnimalAvatar({
  kind,
  scarf,
  size = 40,
}: {
  kind: string;
  scarf?: string;
  size?: number;
}) {
  const normalized = normalizeKind(kind);
  return (
    <svg
      width={size}
      height={size}
      viewBox="12 -14 96 100"
      role="img"
      aria-label={ALL_ANIMALS.find((animal) => animal.id === normalized)?.name ?? normalized}
      className="shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: '#e9e2cd' }}
    >
      <AnimalFigure kind={normalized} scarf={scarf ?? scarfFor(normalized)} />
    </svg>
  );
}
