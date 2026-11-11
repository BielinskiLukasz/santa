"use client";

import { useMemo, useState } from "react";
import { generateKeyPair, randomToken } from "@/crypto/webcrypto";
import { saveAdminLinks, saveAdminSecret } from "@/crypto/keys";
import { getRepository } from "@/firebase";
import { validateDrawInput } from "@/engine";
import { go } from "@/features/router";
import {
  Badge,
  Button,
  Card,
  Notice,
  SectionTitle,
  Toggle,
} from "@/features/ui";
import type { Constraint } from "@/engine";

type Row = { id: string; name: string };

const INITIAL = ["Ania", "Bartek", "Celina", "Dawid"];

export default function AdminCreate() {
  const [rows, setRows] = useState<Row[]>(() =>
    INITIAL.map((name, i) => ({ id: `p${i + 1}`, name })),
  );
  const [nextId, setNextId] = useState(INITIAL.length + 1);
  const [title, setTitle] = useState("Wigilia 2026 🎄");
  const [adminSeesAll, setAdminSeesAll] = useState(false);
  const [mode, setMode] = useState<"sequential" | "all-at-once">("sequential");
  const [bans, setBans] = useState<Set<string>>(new Set());
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const constraints = useMemo<Constraint[]>(
    () =>
      [...bans].map((key) => {
        const [from, to] = key.split("->");
        return [from, to] as Constraint;
      }),
    [bans],
  );

  const validation = useMemo(
    () => validateDrawInput(rows.map((r) => ({ id: r.id, name: r.name })), constraints),
    [rows, constraints],
  );

  const updateName = (id: string, name: string) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, name } : r)));

  const addPerson = () => {
    if (rows.length >= 10) return;
    setRows((current) => [...current, { id: `p${nextId}`, name: "" }]);
    setNextId((value) => value + 1);
  };

  const removePerson = (id: string) => {
    if (rows.length <= 2) return;
    setRows((current) => current.filter((r) => r.id !== id));
    setBans((current) => {
      const next = new Set<string>();
      current.forEach((key) => {
        if (!key.startsWith(`${id}->`) && !key.endsWith(`->${id}`)) next.add(key);
      });
      return next;
    });
  };

  const toggleBan = (from: string, to: string) => {
    const key = `${from}->${to}`;
    setBans((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const importBans = () => {
    const lines = importText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    let added = 0;
    const next = new Set(bans);
    for (const line of lines) {
      const parts = line.split(/->|:|;|,|\t/).map((x) => x.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const from = rows.find(
        (r) => r.name.trim().toLowerCase() === parts[0].toLowerCase(),
      );
      const to = rows.find(
        (r) => r.name.trim().toLowerCase() === parts[1].toLowerCase(),
      );
      if (from && to && from.id !== to.id) {
        next.add(`${from.id}->${to.id}`);
        added += 1;
      }
    }
    setBans(next);
    setImportMessage(
      added > 0
        ? `Dodano ${added} zakaz(ów) z poprzedniego losowania.`
        : "Nie rozpoznano żadnej pary. Użyj formatu „Ania -> Bartek”.",
    );
  };

  const create = async () => {
    setError(null);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setBusy(true);
    try {
      const repo = await getRepository();
      let adminPublicKey: JsonWebKey | null = null;
      let privateKey: JsonWebKey | null = null;
      if (adminSeesAll) {
        const pair = await generateKeyPair();
        adminPublicKey = pair.publicKey;
        privateKey = pair.privateKey;
      }
      const drawId = randomToken(12);
      const adminToken = randomToken(18);
      const participants = rows.map((r) => ({
        id: r.id,
        name: r.name.trim(),
        token: randomToken(16),
      }));
      const created = await repo.create({
        drawId,
        adminToken,
        title: title.trim() || "Sekretny Mikołaj",
        adminSeesAll,
        adminPublicKey,
        mode,
        seed: randomToken(24),
        participants,
        constraints,
      });
      saveAdminSecret(drawId, { adminToken, privateKey });
      saveAdminLinks(drawId, created.links);
      go(`a/${drawId}?t=${adminToken}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się utworzyć losowania.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          eyebrow="Panel administratora"
          title="Nowe losowanie"
          description="Utwórz grupę, ustaw zakazy i wyślij każdemu jego prywatny link. Wszystkie parametry przekazywane są w hashu URL."
        />
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--pine-dark)]">
              Nazwa losowania
            </span>
            <input
              className="input"
              value={title}
              maxLength={80}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="np. Wigilia u babci"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--pine-dark)]">
                Uczestnicy ({rows.length}/10)
              </span>
              <Button variant="ghost" small onClick={addPerson} disabled={rows.length >= 10} type="button">
                + Dodaj osobę
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-xs font-bold text-[#8aa096]">
                    {index + 1}
                  </span>
                  <input
                    className="input"
                    value={row.name}
                    maxLength={40}
                    aria-label={`Imię osoby ${index + 1}`}
                    onChange={(event) => updateName(row.id, event.target.value)}
                    placeholder={`Osoba ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removePerson(row.id)}
                    disabled={rows.length <= 2}
                    aria-label={`Usuń osobę ${index + 1}`}
                    className="shrink-0 rounded-xl px-2 py-1 text-lg text-[#b23a48] disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={adminSeesAll}
              onChange={setAdminSeesAll}
              label="Admin widzi wszystkie wyniki"
              hint="Tworzy dodatkową parę kluczy admina i zapisuje dodatkowe szyfrogramy."
            />
            <label className="block rounded-2xl border border-[rgba(18,68,51,0.14)] bg-white/70 p-3.5">
              <span className="block text-sm font-semibold text-[var(--pine-dark)]">
                Tryb losowania
              </span>
              <select
                className="input mt-2"
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as "sequential" | "all-at-once")
                }
              >
                <option value="sequential">Każdy losuje sam, po kolei</option>
                <option value="all-at-once">Admin losuje wszystko naraz</option>
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          eyebrow="Ograniczenia"
          title="Kto komu nie może kupić"
          description="Zakazy są skierowane: zaznaczenie Ania → Bartek nie blokuje Bartka → Ania. Kliknij kratkę, aby przełączyć zakaz."
        />
        <div className="matrix-scroll rounded-2xl border border-[rgba(18,68,51,0.1)] bg-white/70 p-3">
          <table className="border-separate border-spacing-1 text-center">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white/90 px-2 text-left text-[0.7rem] text-[#5a7268]">
                  kupuje ↓ / dla →
                </th>
                {rows.map((r) => (
                  <th key={r.id} className="px-1 text-[0.7rem] font-bold text-[var(--pine)]">
                    {(r.name.trim() || r.id).slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((from) => (
                <tr key={from.id}>
                  <th className="sticky left-0 z-10 bg-white/90 px-2 text-left text-xs font-semibold text-[var(--pine)]">
                    {(from.name.trim() || from.id).slice(0, 8)}
                  </th>
                  {rows.map((to) => {
                    const key = `${from.id}->${to.id}`;
                    const diagonal = from.id === to.id;
                    return (
                      <td key={to.id}>
                        <button
                          type="button"
                          disabled={diagonal}
                          onClick={() => toggleBan(from.id, to.id)}
                          aria-label={`${from.name} nie może kupić dla ${to.name}`}
                          aria-pressed={bans.has(key)}
                          title={diagonal ? "Nie można obdarować samego siebie" : `${from.name} → ${to.name}`}
                          className={`matrix-cell ${diagonal ? "diagonal" : ""} ${bans.has(key) ? "on" : ""}`}
                        >
                          {diagonal ? "—" : bans.has(key) ? "✕" : "·"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[#5a7268]">
          Zaznaczone: <Badge tone="red">{constraints.length} zakazów</Badge> ·
          Poprawne przypisania: <Badge tone={validation.ok ? "green" : "red"}>{validation.solutions}</Badge>
        </p>

        <div className="mt-5 rounded-2xl bg-[#f7f4e9] p-4">
          <label className="block text-sm font-semibold text-[var(--pine-dark)]" htmlFor="import">
            Import zakazów z poprzedniego losowania
          </label>
          <p className="mt-1 text-xs text-[#5a7268]">
            Wklej wyniki zeszłego roku, po jednej parze w wierszu: „Ania -&gt; Bartek”.
          </p>
          <textarea
            id="import"
            className="input mt-2 min-h-[84px] resize-y"
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={"Ania -> Bartek\nCelina -> Dawid"}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button variant="ghost" small onClick={importBans} type="button">
              Importuj pary
            </Button>
            {importMessage && <span className="text-xs text-[#5a7268]">{importMessage}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="Gotowość" title="Sprawdzenie przed startem" />
        {validation.ok ? (
          <Notice tone="success">
            ✅ Dla {rows.length} osób i {constraints.length} zakazów istnieje{" "}
            <strong>{validation.solutions}</strong> poprawnych przypisań. Można utworzyć losowanie.
          </Notice>
        ) : (
          <Notice tone="error">⚠️ {validation.error}</Notice>
        )}
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => void create()} disabled={busy || !validation.ok} type="button">
            {busy ? "Tworzenie…" : "🎄 Utwórz i wygeneruj linki"}
          </Button>
          <Button variant="ghost" onClick={() => go("")} type="button">
            Anuluj
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[#5a7268]">
          Po utworzeniu zapisz swój link administratorski – jest jedynym kluczem do panelu.
          Linki uczestników i klucz admina pozostają w tej przeglądarce.
        </p>
      </Card>
    </div>
  );
}
