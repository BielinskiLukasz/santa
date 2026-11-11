import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { firebaseConfig, USE_EMULATORS } from "./config";
import { readAdminSecret } from "@/crypto/keys";
import {
  buildAllowedMatrix,
  countCompletions,
  indexMaps,
  validateDrawInput,
} from "@/engine";
import type {
  ActionRequest,
  ActionResponse,
  AnimationStep,
  AssignmentCommit,
  CreateDrawInput,
  CreatedDraw,
  DrawRepository,
  ParticipantView,
  PublicDraw,
  RosterEntry,
  Snapshot,
} from "@/shared/types";

type ResultBox = {
  encryptedResult: string;
  encryptedResultForAdmin: string | null;
};

type DrawDoc = {
  id: string;
  title: string;
  status: PublicDraw["status"];
  adminSeesAll: boolean;
  adminPublicKey: JsonWebKey | null;
  adminUid: string;
  mode: PublicDraw["mode"];
  seed: string;
  constraints: [string, string][];
  roster: RosterEntry[];
  takenReceivers: string[];
  drawnGivers: string[];
  steps: AnimationStep[];
  /** Zaszyfrowane wyniki wszystkich osób. Klucz = publiczne id (pid). */
  resultBoxes: Record<string, ResultBox>;
  /** Zaszyfrowane kopie dla admina, tylko gdy adminSeesAll = true. */
  adminResults: Record<string, string>;
  epoch: number;
  createdAt: number;
};

type ParticipantDoc = {
  id: string;
  name: string;
  uid: string | null;
  publicKey: JsonWebKey | null;
  claimed: boolean;
  encryptedResult: string | null;
  encryptedResultForAdmin: string | null;
  animation: AnimationStep | null;
};

type LockDoc = {
  holder: string | null;
  holderPid: string | null;
  acquiredAt: Timestamp | null;
  epoch: number;
};

let store: Firestore | null = null;
let emulatorsConnected = false;

function app() {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

function firestore(): Firestore {
  if (!store) store = getFirestore(app());
  if (USE_EMULATORS && !emulatorsConnected) {
    connectFirestoreEmulator(store, "127.0.0.1", 8080);
    try {
      connectAuthEmulator(getAuth(app()), "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    } catch {
      // emulator już podłączony
    }
    emulatorsConnected = true;
  }
  return store;
}

async function authUid(): Promise<string> {
  const auth = getAuth(app());
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser?.uid ?? "";
}

const drawRef = (id: string) => doc(firestore(), "draws", id);
const participantRef = (id: string, token: string) =>
  doc(firestore(), "draws", id, "participants", token);
const lockRef = (id: string) => doc(firestore(), "draws", id, "state", "lock");

function fail(message: string): never {
  throw new Error(message);
}

function snapshotFrom(
  drawDoc: DrawDoc | null,
  lock: LockDoc | null,
  me: ParticipantDoc | null,
  token: string | null,
  adminToken: string | null,
): Snapshot | null {
  if (!drawDoc) return null;
  const view: PublicDraw = {
    ...drawDoc,
    lock: {
      holder: lock?.holderPid ?? null,
      acquiredAt: lock?.acquiredAt?.toMillis?.() ?? null,
      epoch: lock?.epoch ?? 0,
    },
    steps: drawDoc.steps ?? [],
  };
  const box = me ? drawDoc.resultBoxes?.[me.id] : undefined;
  const mine: ParticipantView | null =
    me && token
      ? {
          id: me.id,
          token,
          name: me.name,
          uid: me.uid,
          publicKey: me.publicKey,
          claimed: me.claimed,
          encryptedResult: me.encryptedResult ?? box?.encryptedResult ?? null,
          encryptedResultForAdmin:
            me.encryptedResultForAdmin ?? box?.encryptedResultForAdmin ?? null,
          animation: me.animation,
        }
      : null;
  return {
    draw: view,
    me: mine,
    adminResults:
      adminToken && adminToken === readAdminSecret(drawDoc.id)?.adminToken
        ? Object.entries(drawDoc.adminResults ?? {}).map(([giver, cipher]) => ({
            giver,
            cipher,
          }))
        : [],
  };
}

function validateCommit(
  draw: DrawDoc,
  assignments: AssignmentCommit[],
  firstGiver: string | null,
): void {
  if (
    assignments.length === 0 ||
    assignments.length > draw.roster.length ||
    (firstGiver && assignments[0].giver !== firstGiver)
  ) {
    fail("Nieprawidłowy zestaw wyników.");
  }
  const participants = draw.roster.map((p) => ({ id: p.id, name: p.name }));
  const allowed = buildAllowedMatrix(participants, draw.constraints);
  const { byId } = indexMaps(participants);
  let mask = 0;
  for (const id of draw.takenReceivers) {
    const i = byId.get(id);
    if (i !== undefined) mask |= 1 << i;
  }
  const seenGivers = new Set<string>();
  const seenReceivers = new Set<string>();
  for (const a of assignments) {
    const i = byId.get(a.giver);
    const j = byId.get(a.receiver);
    if (i === undefined || j === undefined) fail("Nieznana osoba w wyniku.");
    if (!allowed[i][j]) fail("Wynik narusuje zakazy.");
    if (draw.takenReceivers.includes(a.receiver) || seenReceivers.has(a.receiver)) {
      fail("Odbiorca został już wylosowany.");
    }
    if (draw.drawnGivers.includes(a.giver) || seenGivers.has(a.giver)) {
      fail("Ta osoba ma już wynik.");
    }
    if (!a.encryptedResult) fail("Brak szyfrogramu.");
    if (draw.resultBoxes?.[a.giver]) fail("Wynik tej osoby już istnieje.");
    seenGivers.add(a.giver);
    seenReceivers.add(a.receiver);
    mask |= 1 << j;
  }
  const remaining = participants
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !draw.drawnGivers.includes(p.id) && !seenGivers.has(p.id))
    .map(({ i }) => i);
  if (countCompletions(allowed, remaining, mask) === 0) {
    fail("Ten wybór uniemożliwia dokończenie losowania.");
  }
}

/** Adapter Firebase Spark: Firestore + Anonymous Auth, bez Cloud Functions. */
export const firebaseRepository: DrawRepository = {
  mode: "firebase",

  async create(input: CreateDrawInput): Promise<CreatedDraw> {
    const fs = firestore();
    const adminUid = await authUid();
    const validation = validateDrawInput(
      input.participants.map((p) => ({ id: p.id, name: p.name })),
      input.constraints,
    );
    if (!validation.ok) fail(validation.error ?? "Brak rozwiązania.");
    const drawDoc: DrawDoc = {
      id: input.drawId,
      title: input.title,
      status: "lobby",
      adminSeesAll: input.adminSeesAll,
      adminPublicKey: input.adminPublicKey,
      adminUid,
      mode: input.mode,
      seed: input.seed,
      constraints: input.constraints,
      roster: input.participants.map((p) => ({
        id: p.id,
        name: p.name,
        publicKey: null,
        claimed: false,
        hasResult: false,
      })),
      takenReceivers: [],
      drawnGivers: [],
      steps: [],
      resultBoxes: {},
      adminResults: {},
      epoch: 0,
      createdAt: Date.now(),
    };
    const batch = writeBatch(fs);
    batch.set(drawRef(input.drawId), drawDoc);
    for (const p of input.participants) {
      batch.set(participantRef(input.drawId, p.token), {
        id: p.id,
        name: p.name,
        uid: null,
        publicKey: null,
        claimed: false,
        encryptedResult: null,
        encryptedResultForAdmin: null,
        animation: null,
      } satisfies ParticipantDoc);
    }
    batch.set(lockRef(input.drawId), {
      holder: null,
      holderPid: null,
      acquiredAt: null,
      epoch: 0,
    } satisfies LockDoc);
    await batch.commit();
    return {
      drawId: input.drawId,
      adminToken: input.adminToken,
      links: input.participants.map((p) => ({
        id: p.id,
        name: p.name,
        token: p.token,
      })),
    };
  },

  subscribe(drawId, token, adminToken, onSnapshotCallback, onError) {
    let latestDraw: DrawDoc | null = null;
    let latestLock: LockDoc | null = null;
    let latestMe: ParticipantDoc | null = null;
    let active = true;
    let unsubscribers: (() => void)[] = [];
    const emit = () =>
      onSnapshotCallback(
        snapshotFrom(latestDraw, latestLock, latestMe, token, adminToken),
      );

    // Reguły wymagają Anonymous Auth – najpierw logujemy, potem subskrybujemy.
    void authUid()
      .then(() => {
        if (!active) return;
        unsubscribers = [
          onSnapshot(
            drawRef(drawId),
            (snap) => {
              latestDraw = snap.exists() ? (snap.data() as DrawDoc) : null;
              emit();
            },
            (error) => onError(error.message),
          ),
          onSnapshot(lockRef(drawId), (snap) => {
            latestLock = snap.exists() ? (snap.data() as LockDoc) : null;
            emit();
          }),
          token
            ? onSnapshot(participantRef(drawId, token), (snap) => {
                latestMe = snap.exists() ? (snap.data() as ParticipantDoc) : null;
                emit();
              })
            : () => {},
        ];
      })
      .catch((error: unknown) =>
        onError(error instanceof Error ? error.message : "Błąd uwierzytelnienia."),
      );

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  },

  async action(drawId: string, request: ActionRequest): Promise<ActionResponse> {
    const fs = firestore();
    switch (request.type) {
      case "join": {
        const currentUid = await authUid();
        await runTransaction(fs, async (tx) => {
          const pRef = participantRef(drawId, request.token);
          const dRef = drawRef(drawId);
          const pSnap = await tx.get(pRef);
          const dSnap = await tx.get(dRef);
          if (!pSnap.exists() || !dSnap.exists()) fail("Nieprawidłowy link.");
          const p = pSnap.data() as ParticipantDoc;
          const d = dSnap.data() as DrawDoc;
          if (d.status !== "lobby") fail("Losowanie już wystartowało.");
          const sameKey =
            p.publicKey !== null &&
            JSON.stringify(p.publicKey) === JSON.stringify(request.publicKey);
          if (p.uid && p.uid !== currentUid && !sameKey) {
            fail("Ten link jest już przypisany do innej przeglądarki. Użyj linku ratunkowego.");
          }
          tx.update(pRef, {
            uid: currentUid,
            publicKey: request.publicKey,
            claimed: true,
          });
          tx.update(dRef, {
            roster: d.roster.map((r) =>
              r.id === p.id
                ? { ...r, publicKey: request.publicKey, claimed: true }
                : r,
            ),
          });
        });
        return { ok: true };
      }

      case "start": {
        const currentUid = await authUid();
        await runTransaction(fs, async (tx) => {
          const dRef = drawRef(drawId);
          const snap = await tx.get(dRef);
          if (!snap.exists()) fail("Nie znaleziono losowania.");
          const d = snap.data() as DrawDoc;
          if (d.adminUid !== currentUid || !request.adminToken) {
            fail("Brak uprawnień administratora. Użyj linku administratorskiego z tej przeglądarki.");
          }
          if (d.roster.some((r) => !r.claimed || !r.publicKey)) {
            fail("Nie wszyscy uczestnicy dołączyli.");
          }
          if (
            !validateDrawInput(
              d.roster.map((r) => ({ id: r.id, name: r.name })),
              d.constraints,
            ).ok
          ) {
            fail("Dla tych zakazów nie ma rozwiązania.");
          }
          tx.update(dRef, { status: "running" });
        });
        return { ok: true };
      }

      case "lock-acquire": {
        const currentUid = await authUid();
        return runTransaction(fs, async (tx) => {
          const lSnap = await tx.get(lockRef(drawId));
          const dSnap = await tx.get(drawRef(drawId));
          const pSnap = await tx.get(participantRef(drawId, request.token));
          if (!dSnap.exists() || !pSnap.exists()) fail("Nieprawidłowy link.");
          const d = dSnap.data() as DrawDoc;
          const p = pSnap.data() as ParticipantDoc;
          if (d.status !== "running") fail("Losowanie nie jest aktywne.");
          if (p.uid !== currentUid) fail("Nieprawidłowy token uczestnika.");
          if (p.encryptedResult || d.resultBoxes?.[p.id]) {
            return { ok: true, acquired: false, alreadyCommitted: true };
          }
          const lock: LockDoc = lSnap.exists()
            ? (lSnap.data() as LockDoc)
            : { holder: null, holderPid: null, acquiredAt: null, epoch: 0 };
          const expired =
            !lock.acquiredAt || Date.now() - lock.acquiredAt.toMillis() > 20_000;
          if (lock.holder && lock.holder !== currentUid && !expired) {
            return { ok: true, acquired: false };
          }
          const epoch = lock.epoch + 1;
          tx.set(lockRef(drawId), {
            holder: currentUid,
            holderPid: p.id,
            acquiredAt: serverTimestamp(),
            epoch,
          });
          return { ok: true, acquired: true, epoch, acquiredAt: Date.now() };
        });
      }

      case "lock-release": {
        const currentUid = await authUid();
        await runTransaction(fs, async (tx) => {
          const lRef = lockRef(drawId);
          const snap = await tx.get(lRef);
          if (!snap.exists()) return;
          const lock = snap.data() as LockDoc;
          if (lock.holder !== currentUid || lock.epoch !== request.epoch) return;
          tx.set(lRef, {
            holder: null,
            holderPid: null,
            acquiredAt: null,
            epoch: lock.epoch + 1,
          });
        });
        return { ok: true };
      }

      case "commit": {
        const currentUid = await authUid();
        return runTransaction(fs, async (tx) => {
          const lRef = lockRef(drawId);
          const dRef = drawRef(drawId);
          const pRef = participantRef(drawId, request.token);
          const lSnap = await tx.get(lRef);
          const dSnap = await tx.get(dRef);
          const pSnap = await tx.get(pRef);
          if (!dSnap.exists() || !pSnap.exists() || !lSnap.exists()) {
            fail("Nie znaleziono stanu losowania.");
          }
          const draw = dSnap.data() as DrawDoc;
          const mine = pSnap.data() as ParticipantDoc;
          const lock = lSnap.data() as LockDoc;
          if (mine.uid !== currentUid) fail("Nieprawidłowy właściciel linku.");
          if (mine.encryptedResult || draw.resultBoxes?.[mine.id]) {
            return { ok: true, alreadyCommitted: true };
          }
          if (
            lock.holder !== currentUid ||
            lock.epoch !== request.epoch ||
            Date.now() - (lock.acquiredAt?.toMillis() ?? 0) > 20_000
          ) {
            fail("Blokada wygasła lub jest stara. Wynik odrzucony, spróbuj ponownie.");
          }
          validateCommit(draw, request.assignments, mine.id);

          const boxes: Record<string, ResultBox> = { ...(draw.resultBoxes ?? {}) };
          const adminResults: Record<string, string> = { ...(draw.adminResults ?? {}) };
          const giverIds = new Set<string>();
          for (const a of request.assignments) {
            boxes[a.giver] = {
              encryptedResult: a.encryptedResult,
              encryptedResultForAdmin: a.encryptedResultForAdmin ?? null,
            };
            giverIds.add(a.giver);
            if (draw.adminSeesAll && a.encryptedResultForAdmin) {
              adminResults[a.giver] = a.encryptedResultForAdmin;
            }
          }
          const own = boxes[mine.id];
          tx.update(pRef, {
            encryptedResult: own.encryptedResult,
            encryptedResultForAdmin: own.encryptedResultForAdmin,
            animation: request.animation,
          });
          const taken = [
            ...draw.takenReceivers,
            ...request.assignments.map((a) => a.receiver),
          ];
          const drawn = [
            ...draw.drawnGivers,
            ...request.assignments.map((a) => a.giver),
          ];
          tx.update(dRef, {
            takenReceivers: taken,
            drawnGivers: drawn,
            steps: [...draw.steps, request.animation],
            status: drawn.length >= draw.roster.length ? "done" : "running",
            epoch: draw.epoch + 1,
            resultBoxes: boxes,
            adminResults,
            roster: draw.roster.map((r) =>
              giverIds.has(r.id) ? { ...r, hasResult: true } : r,
            ),
          });
          tx.set(lRef, {
            holder: null,
            holderPid: null,
            acquiredAt: null,
            epoch: lock.epoch + 1,
          });
          return { ok: true };
        });
      }

      case "draw-all": {
        const currentUid = await authUid();
        return runTransaction(fs, async (tx) => {
          const dRef = drawRef(drawId);
          const dSnap = await tx.get(dRef);
          if (!dSnap.exists()) fail("Nie znaleziono losowania.");
          const draw = dSnap.data() as DrawDoc;
          if (draw.adminUid !== currentUid || !request.adminToken) {
            fail("Brak uprawnień administratora. Użyj linku administratorskiego z tej przeglądarki.");
          }
          if (draw.status === "done" || draw.drawnGivers.length > 0) {
            fail("Wyniki już istnieją.");
          }
          if (draw.roster.some((r) => !r.claimed || !r.publicKey)) {
            fail("Nie wszyscy uczestnicy dołączyli.");
          }
          validateCommit(draw, request.assignments, null);
          const boxes: Record<string, ResultBox> = {};
          const adminResults: Record<string, string> = {};
          for (const a of request.assignments) {
            boxes[a.giver] = {
              encryptedResult: a.encryptedResult,
              encryptedResultForAdmin: a.encryptedResultForAdmin ?? null,
            };
            if (draw.adminSeesAll && a.encryptedResultForAdmin) {
              adminResults[a.giver] = a.encryptedResultForAdmin;
            }
          }
          tx.update(dRef, {
            resultBoxes: boxes,
            adminResults,
            takenReceivers: request.assignments.map((a) => a.receiver),
            drawnGivers: request.assignments.map((a) => a.giver),
            steps: request.steps,
            status: "done",
            epoch: draw.epoch + 1,
            roster: draw.roster.map((r) => ({ ...r, hasResult: true })),
          });
          return { ok: true };
        });
      }

      default:
        return fail("Nieznana akcja.");
    }
  },
};
