import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Model danych lokalnego backendu (tryb demo / sandbox) odwzorowuje 1:1 model
 * Firestore z ROADMAP.md. W produkcji na GitHub Pages używany jest adapter Firebase.
 */
export const draws = pgTable("draws", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status").notNull().default("lobby"),
  adminToken: text("admin_token").notNull(),
  adminPublicKey: jsonb("admin_public_key").$type<JsonWebKey | null>(),
  adminSeesAll: boolean("admin_sees_all").notNull().default(false),
  mode: text("mode").notNull().default("sequential"),
  constraints: jsonb("constraints").$type<[string, string][]>().notNull().default([]),
  seed: text("seed").notNull(),
  takenReceivers: jsonb("taken_receivers").$type<string[]>().notNull().default([]),
  drawnGivers: jsonb("drawn_givers").$type<string[]>().notNull().default([]),
  steps: jsonb("steps").$type<unknown[]>().notNull().default([]),
  lockHolder: text("lock_holder"),
  lockAcquiredAt: timestamp("lock_acquired_at", { withTimezone: true }),
  lockEpoch: integer("lock_epoch").notNull().default(0),
  epoch: integer("epoch").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participants = pgTable(
  "participants",
  {
    token: text("token").primaryKey(),
    drawId: text("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),
    pid: text("pid").notNull(),
    name: text("name").notNull(),
    uid: text("uid"),
    publicKey: jsonb("public_key").$type<JsonWebKey | null>(),
    claimed: boolean("claimed").notNull().default(false),
    encryptedResult: text("encrypted_result"),
    encryptedResultForAdmin: text("encrypted_result_for_admin"),
    animation: jsonb("animation").$type<unknown | null>(),
  },
  (table) => [uniqueIndex("participants_draw_pid_unique").on(table.drawId, table.pid)],
);
