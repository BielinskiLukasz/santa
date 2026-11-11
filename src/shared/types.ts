import type { Constraint } from "@/engine";

export type DrawStatus = "lobby" | "running" | "done";
export type DrawMode = "sequential" | "all-at-once";

export type RosterEntry = {
  id: string;
  name: string;
  publicKey: JsonWebKey | null;
  claimed: boolean;
  hasResult: boolean;
};

export type LockState = {
  /** pid osoby trzymającej blokadę (token nigdy nie opuszcza serwera) */
  holder: string | null;
  acquiredAt: number | null;
  epoch: number;
};

/** Wspólny log kroków NIE zawiera wyników – tylko dane do odtworzenia animacji. */
export type AnimationStep = {
  giver: string;
  at: number;
  seedLabel: number;
  candidates: string[];
  forcedTail: number;
};

export type PublicDraw = {
  id: string;
  title: string;
  status: DrawStatus;
  adminSeesAll: boolean;
  adminPublicKey: JsonWebKey | null;
  mode: DrawMode;
  constraints: Constraint[];
  seed: string;
  roster: RosterEntry[];
  takenReceivers: string[];
  drawnGivers: string[];
  steps: AnimationStep[];
  lock: LockState;
  epoch: number;
  createdAt: number;
};

export type ParticipantView = {
  id: string;
  token: string;
  name: string;
  uid: string | null;
  publicKey: JsonWebKey | null;
  claimed: boolean;
  encryptedResult: string | null;
  encryptedResultForAdmin: string | null;
  animation: AnimationStep | null;
};

export type AdminResult = { giver: string; cipher: string | null };

/** Jeden odczyt stanu: dokument losowania + własny dokument + kopie dla admina. */
export type Snapshot = {
  draw: PublicDraw;
  me: ParticipantView | null;
  adminResults: AdminResult[];
};

export type AssignmentCommit = {
  giver: string;
  receiver: string;
  encryptedResult: string;
  encryptedResultForAdmin: string | null;
};

export type CreateParticipantInput = {
  id: string;
  name: string;
  token: string;
};

export type CreateDrawInput = {
  drawId: string;
  adminToken: string;
  title: string;
  adminSeesAll: boolean;
  adminPublicKey: JsonWebKey | null;
  mode: DrawMode;
  seed: string;
  participants: CreateParticipantInput[];
  constraints: Constraint[];
};

export type CreatedDraw = {
  drawId: string;
  adminToken: string;
  links: { id: string; name: string; token: string }[];
};

export type ActionRequest =
  | { type: "join"; token: string; uid: string; publicKey: JsonWebKey }
  | { type: "start"; adminToken: string }
  | { type: "lock-acquire"; token: string; uid: string }
  | { type: "lock-release"; token: string; uid: string; epoch: number }
  | {
      type: "commit";
      token: string;
      uid: string;
      epoch: number;
      assignments: AssignmentCommit[];
      animation: AnimationStep;
    }
  | {
      type: "draw-all";
      adminToken: string;
      assignments: AssignmentCommit[];
      steps: AnimationStep[];
    };

export type ActionResponse = {
  ok: boolean;
  acquired?: boolean;
  epoch?: number;
  acquiredAt?: number;
  alreadyCommitted?: boolean;
  message?: string;
};

export interface DrawRepository {
  mode: "firebase" | "local";
  create(input: CreateDrawInput): Promise<CreatedDraw>;
  subscribe(
    drawId: string,
    token: string | null,
    adminToken: string | null,
    onSnapshot: (snapshot: Snapshot | null) => void,
    onError: (message: string) => void,
  ): () => void;
  action(drawId: string, request: ActionRequest): Promise<ActionResponse>;
}
