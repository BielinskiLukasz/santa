"use client";

import { useEffect, useMemo, useState } from "react";
import {
  readAdminLinks,
  readAdminSecret,
  type AdminSecret,
  type StoredLink,
} from "@/crypto/keys";
import { decryptWith } from "@/crypto/webcrypto";
import { useRepository, useSnapshot } from "@/features/hooks";
import { absoluteHash } from "@/features/router";
import { performAdminDraw } from "@/features/draw/drawService";
import RevealAnimation from "@/features/draw/RevealAnimation";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  Notice,
  SectionTitle,
  Spinner,
  Stat,
} from "@/features/ui";
import type { AnimationStep } from "@/shared/types";

export default function AdminDashboard({
  drawId,
  adminToken: tokenFromUrl,
}: {
  drawId: string;
  adminToken: string;
}) {
  const repo = useRepository();
  const [secret] = useState<AdminSecret | null>(() => readAdminSecret(drawId));
  const [links] = useState<StoredLink[]>(() => readAdminLinks(drawId));
  const adminToken = tokenFromUrl || secret?.adminToken || "";
  const { snapshot, error, loading } = useSnapshot(repo, drawId, null, adminToken);
  const [results, setResults] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);

  const ciphers = snapshot?.adminResults ?? [];
  const ciphersKey = ciphers.map((r) => r.cipher ?? "").join("|");
  const namesKey = snapshot?.draw.roster.map((p) => p.name).join("|") ?? "";
  const names = useMemo(() => (namesKey ? namesKey.split("|") : []), [namesKey]);

  useEffect(() => {
    if (!secret?.privateKey || !snapshot?.draw.adminSeesAll || ciphers.length === 0) return;
    let cancelled = false;
    void (async () => {
      const decoded: Record<string, string> = {};
      for (const entry of ciphers) {
        if (!entry.cipher) continue;
        try {
          const payload = JSON.parse(
            await decryptWith(secret.privateKey!, entry.cipher),
          ) as { receiver?: string };
          if (payload.receiver) decoded[entry.giver] = payload.receiver;
        } catch {
          // klucz z innej przeglądarki – nie pokazujemy wyniku
        }
      }
      if (!cancelled) setResults(decoded);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciphersKey, secret?.privateKey, snapshot?.draw.adminSeesAll]);

  const run = async (fn: () => Promise<void>) => {
    if (!repo) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Operacja nie udała się.");
    } finally {
      setBusy(false);
      setPhase(null);
    }
  };

  const start = () =>
    run(async () => {
      setPhase("Uruchamiam losowanie…");
      await repo!.action(drawId, { type: "start", adminToken });
    });

  const drawAll = () =>
    run(async () => {
      if (!snapshot?.draw) throw new Error("Brak stanu losowania.");
      await performAdminDraw({
        repo: repo!,
        draw: snapshot.draw,
        adminToken,
        onPhase: setPhase,
      });
    });

  if (loading && !snapshot) {
    return <Card><Spinner label="Ładowanie panelu losowania…" /></Card>;
  }
  if (error && !snapshot) {
    return (
      <Card>
        <Notice tone="error">{error}</Notice>
        <p className="mt-3 text-sm text-[#5a7268]">
          Sprawdź, czy link administratorski jest pełny (z parametrem tokenu w hashu).
        </p>
      </Card>
    );
  }
  if (!snapshot?.draw) {
    return <Card><Notice tone="error">Nie znaleziono tego losowania.</Notice></Card>;
  }

  const draw = snapshot.draw;
  const joined = draw.roster.filter((p) => p.claimed).length;
  const finished = draw.roster.filter((p) => p.hasResult).length;
  const adminLink = absoluteHash(`a/${drawId}?t=${adminToken}`);
  const allClaimed = joined === draw.roster.length;

  return (
    <div className="space-y-6">
      <Card className="border-[rgba(217,164,65,0.45)] bg-gradient-to-br from-white/95 to-[#fff8e8]/95">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge tone={draw.status === "done" ? "green" : draw.status === "running" ? "gold" : "grey"}>
              {draw.status === "lobby" ? "Lobby · oczekiwanie" : draw.status === "running" ? "Losowanie trwa" : "Zakończone"}
            </Badge>
            <h1 className="display-font mt-3 text-3xl font-bold text-[var(--pine-dark)] sm:text-4xl">
              {draw.title}
            </h1>
            <p className="mt-1 text-xs text-[#5a7268]">
              ID: {drawId.slice(0, 10)}… · tryb: {draw.mode === "all-at-once" ? "admin losuje wszystko" : "każdy losuje sam"}
            </p>
          </div>
          <div className="text-4xl" aria-hidden="true">🎄</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Uczestników" value={draw.roster.length} />
          <Stat label="Dołączyło" value={joined} />
          <Stat label="Ma wynik" value={finished} />
          <Stat label="Zakazy" value={draw.constraints.length} />
        </div>
        <div className="mt-5 rounded-2xl bg-white/80 p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--pine-dark)]">
            🔑 Twój link administratorski (zachowaj go!)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-[#436156]">{adminLink}</code>
            <CopyButton value={adminLink} label="Kopiuj" />
          </div>
        </div>
      </Card>

      {(actionError || phase) && (
        <Notice tone={actionError ? "error" : "info"}>{actionError ?? phase}</Notice>
      )}

      {draw.status === "lobby" && (
        <Card>
          <SectionTitle
            eyebrow="Start"
            title="Gotowość uczestników"
            description="Losowanie rusza, gdy każdy otworzy swój link i wygeneruje klucz publiczny."
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void start()} disabled={!allClaimed || busy} type="button">
              ▶ Uruchom losowanie
            </Button>
            {!allClaimed && (
              <span className="self-center text-xs text-[#8a6c1c]">
                Czekamy jeszcze na {draw.roster.length - joined} os./osoby
              </span>
            )}
          </div>
        </Card>
      )}

      {draw.mode === "all-at-once" && draw.status !== "done" && allClaimed && (
        <Card>
          <SectionTitle
            eyebrow="Faza 9"
            title="Admin losuje wszystko naraz"
            description="Ten sam silnik i to samo szyfrowanie, jeden atomowy zapis kompletu wyników."
          />
          <Button variant="red" onClick={() => void drawAll()} disabled={busy} type="button">
            🎲 Losuj dla wszystkich
          </Button>
        </Card>
      )}

      <Card>
        <SectionTitle
          eyebrow="Prywatne linki"
          title="Rozślij uczestnikom"
          description="Każdy link zawiera 128-bitowy token. Przekaż go tylko właścicielowi – kto ma link, ten widzi wynik."
        />
        {links.length === 0 ? (
          <Notice tone="info">
            Linki są dostępne tylko w przeglądarce, w której utworzono losowanie.
            Wróć tam, aby je skopiować.
          </Notice>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => {
              const url = absoluteHash(`d/${drawId}?t=${link.token}`);
              return (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 px-3 py-2.5"
                >
                  <span className="min-w-[7rem] flex-1 text-sm font-semibold text-[var(--pine-dark)]">
                    {link.name}
                  </span>
                  <code className="hidden max-w-[15rem] truncate text-xs text-[#5a7268] sm:block">
                    {url}
                  </code>
                  <CopyButton value={url} label="Kopiuj link" />
                </li>
              );
            })}
          </ul>
        )}
        {links.length > 0 && (
          <div className="mt-3">
            <CopyButton
              value={links
                .map((l) => `${l.name}: ${absoluteHash(`d/${drawId}?t=${l.token}`)}`)
                .join("\n")}
              label="Kopiuj wszystkie linki"
            />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          eyebrow="Status"
          title="Kto dołączył, kto wylosował"
          description="Widok nie ujawnia żadnych wyników – tylko gotowość i fakt zapisania wyniku."
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          {draw.roster.map((person) => (
            <li
              key={person.id}
              className="flex items-center justify-between gap-2 rounded-2xl bg-white/70 px-3 py-2.5"
            >
              <span className="text-sm font-semibold text-[var(--pine-dark)]">{person.name}</span>
              <span className="flex gap-1.5">
                <Badge tone={person.claimed ? "green" : "grey"}>
                  {person.claimed ? "✓ klucz" : "○ czeka"}
                </Badge>
                <Badge tone={person.hasResult ? "red" : "grey"}>
                  {person.hasResult ? "✓ wynik" : "— wynik"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
        {draw.lock.holder && draw.status === "running" && (
          <p className="mt-3 text-xs text-[#8a6c1c]">
            🔒 W tej chwili losuje: {draw.roster.find((p) => p.id === draw.lock.holder)?.name ?? "ktoś"}.
            Blokada wygasa automatycznie po 20 s.
          </p>
        )}
      </Card>

      {draw.adminSeesAll && (
        <Card>
          <SectionTitle
            eyebrow="Wyniki admina"
            title="Kto komu kupuje prezent"
            description="Odszyfrowane lokalnie Twoim kluczem prywatnym. Widoczne tylko dlatego, że wybrano tę opcję przy tworzeniu."
          />
          {Object.keys(results).length === 0 ? (
            <Notice tone="info">
              {finished === 0
                ? "Wyniki pojawią się po pierwszym losowaniu."
                : "Brak klucza prywatnego w tej przeglądarce lub nie udało się odszyfrować kopii. Użyj przeglądarki, w której utworzono losowanie."}
            </Notice>
          ) : (
            <ul className="space-y-2">
              {draw.roster.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-sm"
                >
                  <span className="font-semibold text-[var(--pine-dark)]">{person.name}</span>
                  <span className="text-[#8aa096]">→</span>
                  <span className="font-bold text-[#9b2938]">
                    {results[person.id] ?? "jeszcze bez wyniku"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {draw.steps.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="ghost" type="button" onClick={() => setReplayIndex(0)}>
                🎬 Odtwórz cały przebieg
              </Button>
              <span className="text-xs text-[#5a7268]">{draw.steps.length} krok(ów) z seeda</span>
            </div>
          )}
        </Card>
      )}

      {replayIndex !== null && (
        <Card className="border-[rgba(217,164,65,0.6)]">
          <ReplayPanel
            steps={draw.steps}
            index={replayIndex}
            names={names}
            results={results}
            onNext={() =>
              setReplayIndex((current) =>
                current !== null && current < draw.steps.length - 1 ? current + 1 : null,
              )
            }
            onClose={() => setReplayIndex(null)}
          />
        </Card>
      )}
    </div>
  );
}

function ReplayPanel({
  steps,
  index,
  names,
  results,
  onNext,
  onClose,
}: {
  steps: AnimationStep[];
  index: number;
  names: string[];
  results: Record<string, string>;
  onNext: () => void;
  onClose: () => void;
}) {
  const step = steps[index];
  if (!step) return null;
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8aa096]">
        Krok {index + 1} z {steps.length} · epoka seeda
      </p>
      <RevealAnimation
        key={`${step.seedLabel}:${index}`}
        names={names}
        seedLabel={step.seedLabel}
        target={results[step.giver] ?? null}
        compact
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button small type="button" onClick={onNext}>
          {index < steps.length - 1 ? "Następny krok →" : "Zakończ"}
        </Button>
        <Button small variant="ghost" type="button" onClick={onClose}>
          Zamknij
        </Button>
      </div>
    </div>
  );
}
