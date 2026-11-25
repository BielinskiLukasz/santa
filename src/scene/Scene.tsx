import { memo, useMemo } from 'react';
import { AnimalFigure, EnvelopeFigure, resolveScarves } from './animals';
import type { AnimalMood } from './animals';
import { FIRE_POSITION, layout } from './layout';

export interface SceneParticipant {
  readonly id: string;
  readonly name: string;
  readonly animal: string;
  readonly drawn: boolean;
}

export interface SceneProps {
  readonly participants: readonly SceneParticipant[];
  /** Formatted budget shown on the wooden board, or null before it is agreed. */
  readonly budgetText: string | null;
  /** Garland lights: lit only when the event is finished. */
  readonly lightsOn: boolean;
  readonly moods?: Readonly<Record<string, AnimalMood>>;
  readonly holdingId?: string | null;
  /** Participant currently indicated as the next to draw. */
  readonly selectedId?: string | null;
  /** Participant walking to the hat (its figure animates to the hat stump). */
  readonly actorId?: string | null;
  /** Shows the envelope rising out of the hat during the ceremony. */
  readonly hatEnvelope?: boolean;
  readonly onSelect?: (participantId: string) => void;
  readonly description?: string;
  readonly className?: string;
}

const ANIMAL_BASE = 1.55;

// Where the drawing animal stands while taking the envelope from the hat.
export const HAT_ACTOR = { x: 842, y: 922, scale: 1.62 } as const;

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const STARS = (() => {
  const random = seeded(42);
  return Array.from({ length: 30 }, (_, index) => ({
    x: Math.round(40 + random() * 1840),
    y: Math.round(30 + random() * 300),
    r: 1.6 + random() * 2.1,
    sparkle: index % 6 === 0,
    delay: `${(random() * -4).toFixed(1)}s`,
  }));
})();

const SNOW_LAYERS = [
  { count: 18, radius: 2, opacity: 0.5, duration: '13s', seed: 7 },
  { count: 13, radius: 3, opacity: 0.7, duration: '10s', seed: 21 },
  { count: 9, radius: 4.4, opacity: 0.92, duration: '8s', seed: 55 },
].map((layer) => {
  const random = seeded(layer.seed);
  return {
    ...layer,
    flakes: Array.from({ length: layer.count }, () => ({
      x: Math.round(random() * 1920),
      y: Math.round(random() * 1080),
    })),
  };
});

function Pine({ x, y, scale, shade }: { x: number; y: number; scale: number; shade: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x={-6} y={-20} width={12} height={22} rx={4} fill="#7a5a43" />
      <path d="M0 -150 L31 -97 L-31 -97 Z" fill={shade} />
      <path d="M0 -114 L39 -57 L-39 -57 Z" fill={shade} />
      <path d="M0 -76 L47 -12 L-47 -12 Z" fill={shade} />
      <path d="M0 -150 L31 -97 L10 -97 L0 -122 L-10 -97 L-31 -97 Z" fill="#eef2e4" opacity={0.85} />
      <path d="M0 -114 L39 -57 L12 -57 L0 -84 L-12 -57 L-39 -57 Z" fill="#eef2e4" opacity={0.7} />
      <path d="M0 -76 L47 -12 L14 -12 L0 -42 L-14 -12 L-47 -12 Z" fill="#eef2e4" opacity={0.55} />
    </g>
  );
}

function Campfire() {
  const { x, y } = FIRE_POSITION;
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={8} rx={195} ry={72} fill="#e3a35a" className="flame-glow" />
      <g fill="#8d9291">
        <ellipse cx={-72} cy={26} rx={17} ry={9} />
        <ellipse cx={-38} cy={33} rx={15} ry={8} fill="#a3a8a2" />
        <ellipse cx={0} cy={36} rx={16} ry={8} />
        <ellipse cx={40} cy={33} rx={15} ry={8} fill="#a3a8a2" />
        <ellipse cx={74} cy={26} rx={17} ry={9} />
      </g>
      <rect x={-58} y={16} width={116} height={17} rx={8.5} fill="#8e674d" transform="rotate(9)" />
      <rect x={-58} y={16} width={116} height={17} rx={8.5} fill="#a67b58" transform="rotate(-11)" />
      <g className="flame">
        <path d="M0 22 C-30 20 -44 -4 -32 -28 C-26 -16 -18 -14 -13 -18 C-15 -38 -4 -56 10 -70 C8 -52 26 -42 26 -20 C26 2 16 22 0 22 Z" fill="#d9894e" />
      </g>
      <g className="flame flame-inner">
        <path d="M1 20 C-16 19 -24 4 -16 -12 C-11 -4 -6 -3 -3 -6 C-3 -20 4 -32 13 -42 C12 -28 22 -20 21 -6 C20 8 12 20 1 20 Z" fill="#f0c275" />
        <path d="M2 19 C-7 18 -11 9 -6 0 C-3 3 0 3 2 1 C2 -7 6 -14 11 -20 C10 -10 16 -5 15 3 C14 12 8 19 2 19 Z" fill="#f8e4ad" />
      </g>
    </g>
  );
}

function Hat() {
  return (
    <g transform="translate(960 908)">
      <path d="M-52 26 L-44 2 L44 2 L52 26 Q0 40 -52 26 Z" fill="#a77a5b" />
      <ellipse cx={0} cy={2} rx={44} ry={10} fill="#c59672" />
      <ellipse cx={0} cy={1} rx={25} ry={5.5} fill="#9c7155" />
      <g transform="translate(0 -6)">
        <path d="M-29 0 L-21 -54 Q-19 -66 -6 -66 L8 -66 Q21 -66 23 -54 L29 0 Q0 8 -29 0 Z" fill="#3f5b49" />
        <ellipse cx={0} cy={0} rx={46} ry={11} fill="#334c3d" />
        <path d="M-24 -18 L24 -18 L25 -6 L-25 -6 Z" fill="#e8dec3" />
      </g>
    </g>
  );
}

function BudgetBoard({ text }: { text: string | null }) {
  return (
    <g transform="translate(398 726)" data-budget-board>
      <rect x={-88} y={30} width={13} height={86} rx={5} fill="#7a5a43" />
      <rect x={75} y={30} width={13} height={86} rx={5} fill="#7a5a43" />
      <rect x={-128} y={-62} width={256} height={112} rx={12} fill="#9c7155" />
      <rect x={-116} y={-50} width={232} height={88} rx={8} fill="#a97c5c" />
      <circle cx={-106} cy={-40} r={3.5} fill="#7a5a43" />
      <circle cx={106} cy={-40} r={3.5} fill="#7a5a43" />
      <circle cx={-106} cy={28} r={3.5} fill="#7a5a43" />
      <circle cx={106} cy={28} r={3.5} fill="#7a5a43" />
      {text ? (
        <>
          <text x={0} y={-8} textAnchor="middle" className="font-hand" fontSize={31} fill="#f8f5e8">
            Na prezent:
          </text>
          <text x={0} y={30} textAnchor="middle" className="font-hand" fontWeight={700} fontSize={42} fill="#fff7e0">
            {text}
          </text>
        </>
      ) : (
        <>
          <text x={0} y={-6} textAnchor="middle" className="font-hand" fontSize={33} fill="#f8f5e8">
            Wspólny budżet
          </text>
          <text x={0} y={28} textAnchor="middle" className="font-hand" fontSize={27} fill="#e9dcc0" opacity={0.85}>
            do ustalenia
          </text>
        </>
      )}
    </g>
  );
}

const GARLAND_COLORS = ['#f2c978', '#c98a7a', '#8d9bb8', '#e3a35a'];

function Garland({ lightsOn }: { lightsOn: boolean }) {
  const bulbs = Array.from({ length: 17 }, (_, index) => {
    const x = 150 + index * 101;
    const y = 96 + Math.sin((index / 16) * Math.PI * 2) * 16 + (index % 2) * 8;
    return { x, y, color: GARLAND_COLORS[index % GARLAND_COLORS.length] as string };
  });
  return (
    <g data-garland={lightsOn ? 'on' : 'off'}>
      <path
        d="M120 92 Q480 150 960 104 Q1440 60 1800 108"
        fill="none"
        stroke="#3e5b4d"
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.8}
      />
      {bulbs.map((bulb, index) => (
        <g key={index} className="garland-bulb" opacity={lightsOn ? 1 : 0.16}>
          {lightsOn ? <circle cx={bulb.x} cy={bulb.y} r={17} fill={bulb.color} opacity={0.28} /> : null}
          <circle cx={bulb.x} cy={bulb.y} r={7.5} fill={lightsOn ? bulb.color : '#93a093'} />
        </g>
      ))}
    </g>
  );
}

export const Scene = memo(function Scene({
  participants,
  budgetText,
  lightsOn,
  moods,
  holdingId,
  selectedId,
  actorId,
  hatEnvelope,
  onSelect,
  description,
  className,
}: SceneProps) {
  const slots = useMemo(() => layout(participants.length), [participants.length]);
  const scarves = useMemo(() => resolveScarves(participants.map((person) => person.id)), [participants]);
  const label = description ?? `Zimowa polana wieczorem. Przy ognisku siedzi ${participants.length} zwierząt.`;

  return (
    <svg
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
      data-scene
      className={className}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16282b" />
          <stop offset="0.55" stopColor="#29494a" />
          <stop offset="1" stopColor="#355b57" />
        </linearGradient>
        <linearGradient id="scene-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aebfae" />
          <stop offset="0.35" stopColor="#cfdcc9" />
          <stop offset="1" stopColor="#e9efe0" />
        </linearGradient>
      </defs>

      <rect width={1920} height={1080} fill="url(#scene-sky)" />
      <g fill="#f4e8cd">
        {STARS.map((star, index) =>
          star.sparkle ? (
            <path
              key={index}
              className="star"
              style={{ animationDelay: star.delay }}
              d={`M${star.x} ${star.y - 7} L${star.x + 2} ${star.y - 2} L${star.x + 7} ${star.y} L${star.x + 2} ${star.y + 2} L${star.x} ${star.y + 7} L${star.x - 2} ${star.y + 2} L${star.x - 7} ${star.y} L${star.x - 2} ${star.y - 2} Z`}
            />
          ) : (
            <circle key={index} className="star" style={{ animationDelay: star.delay }} cx={star.x} cy={star.y} r={star.r} />
          ),
        )}
      </g>
      <circle cx={1638} cy={148} r={92} fill="#f4e5c2" opacity={0.12} />
      <circle cx={1638} cy={148} r={47} fill="#f4e5c2" />
      <circle cx={1662} cy={134} r={42} fill="#1d3235" opacity={0.92} />

      <Garland lightsOn={lightsOn} />

      <path d="M0 470 C240 420 420 452 660 428 C900 404 1080 446 1330 420 C1560 396 1740 424 1920 398 L1920 1080 L0 1080 Z" fill="#56766a" />
      <path d="M0 540 C220 492 460 528 720 500 C980 472 1180 516 1440 488 C1640 466 1800 492 1920 470 L1920 1080 L0 1080 Z" fill="#6e8c81" />
      <path d="M0 470 C240 420 420 452 660 428" fill="none" stroke="#e7edde" strokeWidth={13} strokeLinecap="round" opacity={0.75} />
      <path d="M1330 420 C1560 396 1740 424 1920 398" fill="none" stroke="#e7edde" strokeWidth={13} strokeLinecap="round" opacity={0.6} />

      <Pine x={118} y={586} scale={1.25} shade="#2d5148" />
      <Pine x={252} y={566} scale={0.95} shade="#3a6154" />
      <Pine x={1706} y={572} scale={1.05} shade="#2d5148" />
      <Pine x={1832} y={596} scale={1.35} shade="#35594c" />
      <Pine x={430} y={604} scale={0.7} shade="#406556" />
      <Pine x={1508} y={610} scale={0.72} shade="#406556" />

      <rect x={0} y={600} width={1920} height={480} fill="url(#scene-ground)" />
      <path d="M0 640 C300 610 620 636 960 622 C1300 608 1620 634 1920 612 L1920 1080 L0 1080 Z" fill="#dde7d6" opacity={0.8} />

      <BudgetBoard text={budgetText} />
      <Campfire />
      <Hat />
      {hatEnvelope ? (
        <g transform="translate(960 824) scale(1.35)" data-hat-envelope>
          <g className="envelope-rise">
            <EnvelopeFigure />
          </g>
        </g>
      ) : null}

      {participants.map((person, index) => {
        const slot = slots[index];
        if (!slot) return null;
        const factor = slot.scale * ANIMAL_BASE;
        const mood = moods?.[person.id] ?? (holdingId === person.id ? 'holding-envelope' : 'cheerful');
        const isActor = actorId === person.id;
        const posX = isActor ? HAT_ACTOR.x : slot.x;
        const posY = isActor ? HAT_ACTOR.y : slot.y;
        const posScale = isActor ? HAT_ACTOR.scale : factor;
        const selected = selectedId === person.id;
        return (
          <g
            key={person.id}
            data-animal-slot
            data-participant={person.id}
            onClick={onSelect ? () => onSelect(person.id) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            {selected ? (
              <ellipse cx={slot.x} cy={slot.y + 12} rx={76} ry={18} fill="none" stroke="#ddbc89" strokeWidth={3.5} opacity={0.95} />
            ) : null}
            <ellipse cx={slot.x} cy={slot.y + 10} rx={62} ry={13} fill="#a3b8a9" opacity={0.55} />
            <rect x={slot.x - 54} y={slot.y - 6} width={108} height={19} rx={9.5} fill="#9c7155" />
            <ellipse cx={slot.x} cy={slot.y - 6} rx={54} ry={8} fill="#b0825f" />
            <g
              style={{
                transform: `translate(${posX}px, ${posY}px) scale(${posScale})`,
                transformBox: 'view-box',
                transition: 'transform 1500ms cubic-bezier(0.45, 0, 0.25, 1)',
              }}
            >
              <g transform="translate(-60 -126)">
                <AnimalFigure kind={person.animal} scarf={scarves[index] ?? '#b45a4a'} mood={mood} />
              </g>
            </g>
            <g
              data-badge={person.drawn ? 'drawn' : 'empty'}
              transform={`translate(${slot.x + 52 * factor} ${slot.y - 138 * factor})`}
              opacity={person.drawn ? 1 : 0.55}
            >
              <circle r={24} fill="#f8f5e8" opacity={person.drawn ? 0.95 : 0.5} />
              <g transform="scale(0.74)">
                <EnvelopeFigure sealed={person.drawn} />
              </g>
            </g>
            <g transform={`translate(${slot.x} ${slot.y + 34})`} data-nameplate>
              <rect x={-66} y={-17} width={132} height={36} rx={9} fill={selected ? '#b96f52' : '#9c7155'} />
              <circle cx={-54} cy={0} r={3} fill="#7a5a43" />
              <circle cx={54} cy={0} r={3} fill="#7a5a43" />
              <text
                x={0}
                y={9}
                textAnchor="middle"
                className="font-hand"
                fontWeight={600}
                fontSize={person.name.length > 10 ? 25 : 31}
                fill="#fff7e0"
              >
                {person.name}
              </text>
            </g>
          </g>
        );
      })}

      {SNOW_LAYERS.map((layer, layerIndex) => (
        <g
          key={layerIndex}
          className="snow-layer"
          style={{ animationDuration: layer.duration, animationDelay: `${-layerIndex * 3}s` }}
          fill="#f7f4e8"
          // A gentle brightening of the snowfall celebrates the finale (PHASE-6 polish).
          opacity={lightsOn ? Math.min(1, layer.opacity + 0.22) : layer.opacity}
        >
          {layer.flakes.map((flake, index) => (
            <circle key={index} cx={flake.x} cy={flake.y} r={layer.radius} />
          ))}
        </g>
      ))}
    </svg>
  );
});
