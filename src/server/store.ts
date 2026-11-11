import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { sql, type SQL } from "drizzle-orm";
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
  ParticipantView,
  PublicDraw,
  Snapshot,
} from "@/shared/types";

type Row = Record<string, unknown>;
type DrawRow = Row & {
  id: string;
  status: string;
  lock_holder: string | null;
  lock_epoch: number;
  epoch: number;
  lock_acquired_at: Date | string | null;
};

type ParticipantRow = Row & {
  token: string;
  pid: string;
  name: string;
  uid: string | null;
  public_key: JsonWebKey | null;
  claimed: boolean;
  encrypted_result: string | null;
  encrypted_result_for_admin: string | null;
  animation: AnimationStep | null;
};

export class StoreError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

let schemaReady: Promise<void> | null = null;

/** Idempotentne tworzenie tabel – aplikacja działa bez ręcznych migracji. */
export function ensureTables(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS draws (
          id text PRIMARY KEY,
          title text NOT NULL,
          status text NOT NULL DEFAULT 'lobby',
          admin_token text NOT NULL,
          admin_public_key jsonb,
          admin_sees_all boolean NOT NULL DEFAULT false,
          mode text NOT NULL DEFAULT 'sequential',
          constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
          seed text NOT NULL,
          taken_receivers jsonb NOT NULL DEFAULT '[]'::jsonb,
          drawn_givers jsonb NOT NULL DEFAULT '[]'::jsonb,
          steps jsonb NOT NULL DEFAULT '[]'::jsonb,
          lock_holder text,
          lock_acquired_at timestamptz,
          lock_epoch integer NOT NULL DEFAULT 0,
          epoch integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS participants (
          token text PRIMARY KEY,
          draw_id text NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
          pid text NOT NULL,
          name text NOT NULL,
          uid text,
          public_key jsonb,
          claimed boolean NOT NULL DEFAULT false,
          encrypted_result text,
          encrypted_result_for_admin text,
          animation jsonb,
          UNIQUE (draw_id, pid)
        )
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

type Executor = { execute: (query: SQL) => Promise<unknown> };

async function query(executor: Executor, statement: SQL): Promise<Row[]> {
  const result = (await executor.execute(statement)) as { rows?: Row[] };
  return result.rows ?? [];
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asNumber = (value: unknown): number => Number(value ?? 0);
const asTime = (value: unknown): number | null => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};
const jsonb = (value: unknown): string | null =>
  value === null || value === undefined ? null : JSON.stringify(value);

async function loadDraw(drawId: string, executor: Executor = db, forUpdate = false) {
  const rows = await query(
    executor,
    sql`SELECT * FROM draws WHERE id = ${drawId} ${forUpdate ? sql`FOR UPDATE` : sql``}`,
  );
  const row = rows[0] as DrawRow | undefined;
  if (!row) throw new StoreError("Nie znaleziono tego losowania.", 404);
  return row;
}

async function loadParticipants(drawId: string, executor: Executor = db) {
  const rows = await query(
    executor,
    sql`SELECT * FROM participants WHERE draw_id = ${drawId} ORDER BY pid`,
  );
  return rows as ParticipantRow[];
}

function toParticipantView(row: ParticipantRow, token: string): ParticipantView {
  return {
    id: row.pid,
    token,
    name: row.name,
    uid: row.uid,
    publicKey: row.public_key,
    claimed: row.claimed,
    encryptedResult: row.encrypted_result,
    encryptedResultForAdmin: row.encrypted_result_for_admin,
    animation: row.animation,
  };
}

export async function getSnapshot(
  drawId: string,
  token: string | null,
  adminToken: string | null,
): Promise<Snapshot> {
  await ensureTables();
  const row = await loadDraw(drawId);
  const parts = await loadParticipants(drawId);
  const holderPid = row.lock_holder
    ? (parts.find((p) => p.token === row.lock_holder)?.pid ?? null)
    : null;
  const draw: PublicDraw = {
    id: String(row.id),
    title: String(row.title),
    status: row.status as PublicDraw["status"],
    adminSeesAll: Boolean(row.admin_sees_all),
    adminPublicKey: (row.admin_public_key as JsonWebKey | null) ?? null,
    mode: (row.mode as PublicDraw["mode"]) ?? "sequential",
    constraints: asArray<[string, string]>(row.constraints),
    seed: String(row.seed),
    roster: parts.map((p) => ({
      id: p.pid,
      name: p.name,
      publicKey: p.public_key,
      claimed: p.claimed,
      hasResult: Boolean(p.encrypted_result),
    })),
    takenReceivers: asArray<string>(row.taken_receivers),
    drawnGivers: asArray<string>(row.drawn_givers),
    steps: asArray<AnimationStep>(row.steps),
    lock: {
      holder: holderPid,
      acquiredAt: asTime(row.lock_acquired_at),
      epoch: asNumber(row.lock_epoch),
    },
    epoch: asNumber(row.epoch),
    createdAt: asTime(row.created_at) ?? Date.now(),
  };
  const meRow = token ? parts.find((p) => p.token === token) : undefined;
  const isAdmin = Boolean(adminToken && adminToken === row.admin_token);
  return {
    draw,
    me: meRow ? toParticipantView(meRow, meRow.token) : null,
    adminResults: isAdmin
      ? parts.map((p) => ({
          giver: p.pid,
          cipher: p.encrypted_result_for_admin,
        }))
      : [],
  };
}

export async function createDraw(input: CreateDrawInput): Promise<CreatedDraw> {
  await ensureTables();
  const { participants, constraints } = input;
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(input.drawId)) {
    throw new StoreError("Nieprawidłowy identyfikator losowania.");
  }
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(input.adminToken)) {
    throw new StoreError("Nieprawidłowy token administratora.");
  }
  const validation = validateDrawInput(
    participants.map((p) => ({ id: p.id, name: p.name })),
    constraints,
  );
  if (!validation.ok) throw new StoreError(validation.error ?? "Nieprawidłowe dane.");
  if (participants.some((p) => !/^[A-Za-z0-9_-]{10,120}$/.test(p.token))) {
    throw new StoreError("Nieprawidłowy token uczestnika.");
  }
  const seed = randomBytes(24).toString("hex");

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO draws (id, title, status, admin_token, admin_public_key,
        admin_sees_all, mode, constraints, seed, taken_receivers, drawn_givers, steps)
      VALUES (${input.drawId}, ${input.title}, 'lobby', ${input.adminToken},
        ${jsonb(input.adminPublicKey)}::jsonb, ${input.adminSeesAll},
        ${input.mode}, ${jsonb(constraints)}::jsonb, ${seed},
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
    `);
    for (const p of participants) {
      await tx.execute(sql`
        INSERT INTO participants (token, draw_id, pid, name, public_key, claimed)
        VALUES (${p.token}, ${input.drawId}, ${p.id}, ${p.name}, NULL, false)
      `);
    }
  });

  return {
    drawId: input.drawId,
    adminToken: input.adminToken,
    links: participants.map((p) => ({ id: p.id, name: p.name, token: p.token })),
  };
}

async function getOwnedParticipant(
  drawId: string,
  token: string,
  uid: string,
  executor: Executor = db,
): Promise<ParticipantRow> {
  const rows = await query(
    executor,
    sql`SELECT * FROM participants WHERE draw_id = ${drawId} AND token = ${token}`,
  );
  const row = rows[0] as ParticipantRow | undefined;
  if (!row) throw new StoreError("Ten link nie należy do tego losowania.", 403);
  if (row.uid && row.uid !== uid) {
    throw new StoreError(
      "Ten link został już przypisany do innej przeglądarki. Użyj linku ratunkowego.",
      403,
    );
  }
  return row;
}

function validateAssignments(
  draw: DrawRow,
  parts: ParticipantRow[],
  assignments: AssignmentCommit[],
  adminSeesAll: boolean,
  firstGiver: string | null,
): void {
  if (assignments.length === 0 || assignments.length > parts.length) {
    throw new StoreError("Nieprawidłowa liczba wyników w commicie.");
  }
  if (firstGiver && assignments[0].giver !== firstGiver) {
    throw new StoreError("Pierwszy wynik musi należeć do losującego.");
  }
  const participants = parts.map((p) => ({ id: p.pid, name: p.name }));
  const allowed = buildAllowedMatrix(participants, asArray<[string, string]>(draw.constraints));
  const { byId } = indexMaps(participants);
  const taken = asArray<string>(draw.taken_receivers);
  const drawn = asArray<string>(draw.drawn_givers);
  let mask = 0;
  for (const id of taken) {
    const i = byId.get(id);
    if (i !== undefined) mask |= 1 << i;
  }
  const seenReceivers = new Set<string>();
  const seenGivers = new Set<string>();

  for (const assignment of assignments) {
    const i = byId.get(assignment.giver);
    const j = byId.get(assignment.receiver);
    if (i === undefined || j === undefined) {
      throw new StoreError("Wynik wskazuje na nieznaną osobę.");
    }
    if (!allowed[i][j]) throw new StoreError("Wynik narusuje zdefiniowane zakazy.");
    if (taken.includes(assignment.receiver) || seenReceivers.has(assignment.receiver)) {
      throw new StoreError("Ten odbiorca został już wylosowany (kolizja).");
    }
    if (drawn.includes(assignment.giver) || seenGivers.has(assignment.giver)) {
      throw new StoreError("Ta osoba ma już wynik.");
    }
    if (!assignment.encryptedResult) throw new StoreError("Brak szyfrogramu wyniku.");
    if (adminSeesAll && !assignment.encryptedResultForAdmin) {
      throw new StoreError("Brak szyfrogramu dla administratora.");
    }
    const row = parts.find((p) => p.pid === assignment.giver);
    if (row?.encrypted_result) throw new StoreError("Wynik tej osoby już istnieje.");
    seenReceivers.add(assignment.receiver);
    seenGivers.add(assignment.giver);
    mask |= 1 << j;
  }

  const remainingGivers = participants
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !drawn.includes(p.id) && !seenGivers.has(p.id))
    .map(({ i }) => i);
  if (countCompletions(allowed, remainingGivers, mask) === 0) {
    throw new StoreError("Ten wybór uniemożliwia dokończenie losowania.");
  }
}

export async function performAction(
  drawId: string,
  request: ActionRequest,
): Promise<ActionResponse> {
  await ensureTables();

  switch (request.type) {
    case "join": {
      const draw = await loadDraw(drawId);
      if (draw.status !== "lobby") {
        throw new StoreError("Losowanie już wystartowało – nie można dołączyć.");
      }
      const result = await db.execute(sql`
        UPDATE participants SET uid = ${request.uid},
          public_key = ${jsonb(request.publicKey)}::jsonb, claimed = true
        WHERE draw_id = ${drawId} AND token = ${request.token}
          AND (uid IS NULL OR uid = ${request.uid}
               OR public_key = ${jsonb(request.publicKey)}::jsonb)
        RETURNING token
      `);
      const rows = (result as { rows?: Row[] }).rows ?? [];
      if (rows.length === 0) {
        const existing = await getOwnedParticipant(drawId, request.token, request.uid);
        if (!existing.claimed) throw new StoreError("Nie udało się dołączyć.");
      }
      return { ok: true };
    }

    case "start": {
      const draw = await loadDraw(drawId);
      if (draw.admin_token !== request.adminToken) {
        throw new StoreError("Brak uprawnień administratora.", 403);
      }
      if (draw.status !== "lobby") throw new StoreError("Losowanie już wystartowało.");
      const parts = await loadParticipants(drawId);
      if (parts.some((p) => !p.claimed || !p.public_key)) {
        throw new StoreError("Nie wszyscy uczestnicy dołączyli i wygenerowali klucze.");
      }
      const validation = validateDrawInput(
        parts.map((p) => ({ id: p.pid, name: p.name })),
        asArray<[string, string]>(draw.constraints),
      );
      if (!validation.ok) throw new StoreError(validation.error ?? "Brak rozwiązania.");
      await db.execute(sql`UPDATE draws SET status = 'running' WHERE id = ${drawId}`);
      return { ok: true };
    }

    case "lock-acquire": {
      const draw = await loadDraw(drawId);
      if (draw.status !== "running") throw new StoreError("Losowanie nie jest aktywne.");
      const me = await getOwnedParticipant(drawId, request.token, request.uid);
      if (me.encrypted_result) return { ok: true, acquired: false, alreadyCommitted: true };
      // Pojedynczy warunkowy UPDATE = atomowe przejęcie blokady (20 s lease).
      const result = await db.execute(sql`
        UPDATE draws SET lock_holder = ${request.token},
          lock_acquired_at = now(), lock_epoch = lock_epoch + 1, epoch = epoch + 1
        WHERE id = ${drawId} AND status = 'running'
          AND (lock_holder IS NULL OR lock_holder = ${request.token}
               OR lock_acquired_at < now() - interval '20 seconds')
        RETURNING lock_epoch, epoch, lock_acquired_at
      `);
      const rows = (result as { rows?: Row[] }).rows ?? [];
      if (rows.length === 0) return { ok: true, acquired: false };
      return {
        ok: true,
        acquired: true,
        epoch: asNumber(rows[0].lock_epoch),
        acquiredAt: asTime(rows[0].lock_acquired_at) ?? Date.now(),
      };
    }

    case "lock-release": {
      await getOwnedParticipant(drawId, request.token, request.uid);
      await db.execute(sql`
        UPDATE draws SET lock_holder = NULL, lock_acquired_at = NULL,
          lock_epoch = lock_epoch + 1, epoch = epoch + 1
        WHERE id = ${drawId} AND lock_holder = ${request.token}
          AND lock_epoch = ${request.epoch}
      `);
      return { ok: true };
    }

    case "commit": {
      return db.transaction(async (tx) => {
        const draw = await loadDraw(drawId, tx, true);
        const me = await getOwnedParticipant(drawId, request.token, request.uid, tx);
        // Idempotencja: commit się udał, ale odpowiedź zginęła. Sprawdzamy to
        // przed kontrolą statusu, bo reszta grupy mogła już dokończyć losowanie.
        if (me.encrypted_result) {
          return { ok: true, alreadyCommitted: true } satisfies ActionResponse;
        }
        if (draw.status !== "running") throw new StoreError("Losowanie nie jest aktywne.");
        if (draw.lock_holder !== request.token || draw.lock_epoch !== request.epoch) {
          throw new StoreError("Blokada wygasła lub należy do innej osoby. Spróbuj ponownie.", 409);
        }
        if (draw.lock_acquired_at && (asTime(draw.lock_acquired_at) ?? 0) < Date.now() - 20_000) {
          throw new StoreError("Blokada wygasła przed commitem. Spróbuj ponownie.", 409);
        }
        const parts = await loadParticipants(drawId, tx);
        validateAssignments(
          draw,
          parts,
          request.assignments,
          Boolean(draw.admin_sees_all),
          me.pid,
        );

        for (const assignment of request.assignments) {
          const changed = await tx.execute(sql`
            UPDATE participants SET
              encrypted_result = ${assignment.encryptedResult},
              encrypted_result_for_admin = ${assignment.encryptedResultForAdmin ?? null},
              animation = ${jsonb(request.animation)}::jsonb
            WHERE draw_id = ${drawId} AND pid = ${assignment.giver}
              AND encrypted_result IS NULL
            RETURNING pid
          `);
          if (((changed as { rows?: Row[] }).rows ?? []).length === 0) {
            throw new StoreError("Wynik tej osoby został już zapisany. Odśwież stronę.", 409);
          }
        }

        const taken = asArray<string>(draw.taken_receivers).concat(
          request.assignments.map((a) => a.receiver),
        );
        const drawn = asArray<string>(draw.drawn_givers).concat(
          request.assignments.map((a) => a.giver),
        );
        const steps = asArray<AnimationStep>(draw.steps).concat([request.animation]);
        const done = drawn.length >= parts.length ? "done" : "running";
        const updated = await tx.execute(sql`
          UPDATE draws SET taken_receivers = ${jsonb(taken)}::jsonb,
            drawn_givers = ${jsonb(drawn)}::jsonb, steps = ${jsonb(steps)}::jsonb,
            lock_holder = NULL, lock_acquired_at = NULL,
            lock_epoch = lock_epoch + 1, epoch = epoch + 1, status = ${done}
          WHERE id = ${drawId} AND lock_holder = ${request.token}
            AND lock_epoch = ${request.epoch}
          RETURNING id
        `);
        if (((updated as { rows?: Row[] }).rows ?? []).length === 0) {
          throw new StoreError("Zapis odrzucony: stara epoka. Spróbuj ponownie.", 409);
        }
        return { ok: true } satisfies ActionResponse;
      });
    }

    case "draw-all": {
      return db.transaction(async (tx) => {
        const draw = await loadDraw(drawId, tx, true);
        if (draw.admin_token !== request.adminToken) {
          throw new StoreError("Brak uprawnień administratora.", 403);
        }
        if (draw.mode !== "all-at-once") {
          throw new StoreError("To losowanie jest w trybie sekwencyjnym.");
        }
        if (draw.status === "done") throw new StoreError("Losowanie jest już zakończone.");
        const parts = await loadParticipants(drawId, tx);
        if (parts.some((p) => !p.claimed || !p.public_key)) {
          throw new StoreError("Nie wszyscy dołączyli i wygenerowali klucze.");
        }
        if (asArray<string>(draw.drawn_givers).length > 0) {
          throw new StoreError("Wyniki już istnieją.");
        }
        if (request.assignments.length !== parts.length) {
          throw new StoreError("Wymagany wynik dla każdej osoby.");
        }
        validateAssignments(
          draw,
          parts,
          request.assignments,
          Boolean(draw.admin_sees_all),
          null,
        );
        for (const assignment of request.assignments) {
          await tx.execute(sql`
            UPDATE participants SET encrypted_result = ${assignment.encryptedResult},
              encrypted_result_for_admin = ${assignment.encryptedResultForAdmin ?? null},
              animation = ${jsonb(request.steps.find((s) => s.giver === assignment.giver) ?? null)}::jsonb
            WHERE draw_id = ${drawId} AND pid = ${assignment.giver}
          `);
        }
        await tx.execute(sql`
          UPDATE draws SET taken_receivers = ${jsonb(request.assignments.map((a) => a.receiver))}::jsonb,
            drawn_givers = ${jsonb(request.assignments.map((a) => a.giver))}::jsonb,
            steps = ${jsonb(request.steps)}::jsonb, status = 'done',
            lock_holder = NULL, lock_acquired_at = NULL,
            lock_epoch = lock_epoch + 1, epoch = epoch + 1
          WHERE id = ${drawId}
        `);
        return { ok: true } satisfies ActionResponse;
      });
    }

    default:
      throw new StoreError("Nieznana akcja.");
  }
}
