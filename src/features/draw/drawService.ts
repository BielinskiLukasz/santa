import {
  animationSeed,
  computeChoice,
  runFullDraw,
  rngFor,
  type DrawState,
} from "@/engine";
import { encryptFor } from "@/crypto/webcrypto";
import type {
  ActionResponse,
  AnimationStep,
  AssignmentCommit,
  DrawRepository,
  PublicDraw,
  Snapshot,
} from "@/shared/types";

/** Jednorazowy świeży odczyt – odpowiednik get() po przejęciu blokady. */
export function once(
  repo: DrawRepository,
  drawId: string,
  token: string | null,
  adminToken: string | null,
): Promise<Snapshot | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let cleanup = () => {};
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("Nie udało się odczytać świeżego stanu."));
      }
    }, 7000);
    cleanup = repo.subscribe(
      drawId,
      token,
      adminToken,
      (snapshot) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve(snapshot);
      },
      (message) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error(message));
      },
    );
  });
}

function toEngineState(draw: PublicDraw): DrawState {
  return {
    participants: draw.roster.map((p) => ({ id: p.id, name: p.name })),
    constraints: draw.constraints,
    takenReceivers: draw.takenReceivers,
    drawnGivers: draw.drawnGivers,
    seed: draw.seed,
  };
}

function nameOf(draw: PublicDraw, id: string): string {
  return draw.roster.find((p) => p.id === id)?.name ?? id;
}

async function encryptAssignments(
  draw: PublicDraw,
  assignments: { giver: string; receiver: string }[],
): Promise<AssignmentCommit[]> {
  return Promise.all(
    assignments.map(async ({ giver, receiver }) => {
      const giverEntry = draw.roster.find((p) => p.id === giver);
      if (!giverEntry?.publicKey) {
        throw new Error(`Brak klucza publicznego: ${giverEntry?.name ?? giver}`);
      }
      const payload = JSON.stringify({
        title: draw.title,
        giver: giverEntry.name,
        receiver: nameOf(draw, receiver),
        receiverId: receiver,
      });
      const encryptedResult = await encryptFor(giverEntry.publicKey, payload);
      const encryptedResultForAdmin =
        draw.adminSeesAll && draw.adminPublicKey
          ? await encryptFor(draw.adminPublicKey, payload)
          : null;
      return { giver, receiver, encryptedResult, encryptedResultForAdmin };
    }),
  );
}

function makeStep(
  draw: PublicDraw,
  giver: string,
  index: number,
  forcedTail: number,
): AnimationStep {
  return {
    giver,
    at: Date.now(),
    seedLabel: animationSeed(draw.seed, giver, index),
    candidates: draw.roster.map((p) => p.name),
    forcedTail,
  };
}

export type DrawOutcome = "committed" | "busy" | "already-committed";

/**
 * Faza 5: pełny cykl jednej osoby. Wynik NIGDY nie jest pokazywany z pamięci –
 * po commicie klient odczytuje i odszyfrowuje szyfrogram z bazy.
 */
export async function performSequentialDraw(args: {
  repo: DrawRepository;
  drawId: string;
  token: string;
  uid: string;
  onPhase: (message: string) => void;
}): Promise<DrawOutcome> {
  const { repo, drawId, token, uid, onPhase } = args;
  onPhase("Przejmuję blokadę losowania…");
  const lock: ActionResponse = await repo.action(drawId, {
    type: "lock-acquire",
    token,
    uid,
  });
  if (!lock.acquired) {
    return lock.alreadyCommitted ? "already-committed" : "busy";
  }
  const epoch = lock.epoch ?? 0;
  const acquiredAt = lock.acquiredAt ?? Date.now();
  let committed = false;

  try {
    onPhase("Czytam aktualny stan i sprawdzam dostępne opcje…");
    const fresh = await once(repo, drawId, token, null);
    if (!fresh?.draw || !fresh.me) {
      throw new Error("Nie udało się odczytać stanu losowania.");
    }
    const draw = fresh.draw;
    const state = toEngineState(draw);
    const choice = computeChoice(state, fresh.me.id);
    if (!choice.pick) {
      throw new Error(
        "Brak dostępnej opcji dla Ciebie. Powiadom administratora o zbyt wielu zakazach.",
      );
    }
    onPhase("Szyfruję wyniki kluczami publicznymi…");
    const assignments = await encryptAssignments(draw, choice.assignments);
    const animation = makeStep(
      draw,
      fresh.me.id,
      draw.drawnGivers.length,
      choice.forcedTail.length,
    );

    // Margines bezpieczeństwa klienta: nie zapisujemy po ~15 s od przejęcia.
    if (Date.now() - acquiredAt > 15_000) {
      throw new Error("Blokada wygasła przed zapisem. Wynik odrzucony – spróbuj ponownie.");
    }

    onPhase("Zapisuję wynik jednym atomowym commitem…");
    await repo.action(drawId, {
      type: "commit",
      token,
      uid,
      epoch,
      assignments,
      animation,
    });
    committed = true;
    // Lokalny wynik jest celowo porzucany: UI pokaże dopiero odszyfrowany zapis.
    onPhase("Wynik zapisany. Odsłaniam…");
    return "committed";
  } catch (error) {
    if (!committed) {
      try {
        await repo.action(drawId, { type: "lock-release", token, uid, epoch });
      } catch {
        // blokada i tak wygaśnie po 20 s
      }
    }
    throw error;
  }
}

/** Faza 9: admin losuje wszystko naraz tym samym silnikiem. */
export async function performAdminDraw(args: {
  repo: DrawRepository;
  draw: PublicDraw;
  adminToken: string;
  onPhase: (message: string) => void;
}): Promise<void> {
  const { repo, draw, adminToken, onPhase } = args;
  onPhase("Licze poprawne przypisania i losuję jednostajnie…");
  const result = runFullDraw(toEngineState(draw), rngFor(draw.seed, "all"));
  onPhase("Szyfruję wyniki kluczami wszystkich uczestników…");
  const assignments = await encryptAssignments(draw, result.assignments);
  const steps = result.steps.map((step, index) =>
    makeStep(draw, step.giver, index, step.forcedTail),
  );
  onPhase("Zapisuję komplet wyników…");
  await repo.action(draw.id, {
    type: "draw-all",
    adminToken,
    assignments,
    steps,
  });
}
