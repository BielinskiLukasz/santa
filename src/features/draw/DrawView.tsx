"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  decodeKeyFromUrl,
  decryptWith,
  encodeKeyForUrl,
  generateKeyPair,
  publicFromPrivate,
} from "@/crypto/webcrypto";
import { getBrowserUid, readPrivateKey, savePrivateKey } from "@/crypto/keys";
import { animationSeed } from "@/engine";
import { useRepository, useSnapshot } from "@/features/hooks";
import { absoluteHash } from "@/features/router";
import { performSequentialDraw } from "@/features/draw/drawService";
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

type DecryptedResult = {
  title?: string;
  giver?: string;
  receiver?: string;
  receiverId?: string;
};

export default function DrawView({
  drawId,
  token,
  rescue,
}: {
  drawId: string;
  token: string;
  rescue: string | null;
}) {
  const repo = useRepository();
  const { snapshot, error, loading } = useSnapshot(repo, drawId, token, null);
  const [privateKey, setPrivateKey] = useState<JsonWebKey | null>(null);
  const [result, setResult] = useState<DecryptedResult | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const joinedRef = useRef(false);
  const drawRef = useRef<() => void>(() => {});

  const me = snapshot?.me ?? null;
  const draw = snapshot?.draw ?? null;

  // Faza 3: klucz prywatny zostaje lokalnie; link ratunkowy go przywraca.
  useEffect(() => {
    if (!me) return;
    const stored = readPrivateKey(drawId, token);
    const rescued = rescue ? decodeKeyFromUrl(rescue) : null;
    if (rescued && !stored) {
      savePrivateKey(drawId, token, rescued);
      setPrivateKey(rescued);
      return;
    }
    if (stored) {
      setPrivateKey(stored);
      return;
    }
    let active = true;
    void generateKeyPair()
      .then((pair) => {
        if (!active) return;
        savePrivateKey(drawId, token, pair.privateKey);
        setPrivateKey(pair.privateKey);
      })
      .catch(() => {
        if (active) setKeyError("Nie udało się wygenerować kluczy (wymagane WebCrypto / HTTPS).");
      });
    return () => {
      active = false;
    };
  }, [drawId, token, rescue, me?.id]);

  // Dołączanie: publicKey + uid (Anonymous Auth w adapterze Firebase).
  useEffect(() => {
    if (!repo || !privateKey || !me || !draw) return;
    if (draw.status !== "lobby") return;
    if (me.claimed && me.publicKey && me.uid === getBrowserUid()) return;
    if (joinedRef.current) return;
    joinedRef.current = true;
    void repo
      .action(drawId, {
        type: "join",
        token,
        uid: getBrowserUid(),
        publicKey: publicFromPrivate(privateKey),
      })
      .catch((cause) => {
        setKeyError(cause instanceof Error ? cause.message : "Nie udało się dołączyć.");
      });
  }, [repo, privateKey, me?.id, me?.claimed, me?.publicKey, draw?.status, drawId, token]);

  // Krok 6 przepływu: wynik wyłącznie z odszyfrowanego szyfrogramu w bazie.
  const cipher = me?.encryptedResult ?? null;
  useEffect(() => {
    if (!cipher || !privateKey) return;
    let active = true;
    void decryptResult(cipher, privateKey)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active) {
          setKeyError(
            "Nie udało się odszyfrować wyniku. Otwórz link ratunkowy z kluczem prywatnym z pierwotnej przeglądarki.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [cipher, privateKey]);

  const doDraw = useCallback(async () => {
    if (!repo || !privateKey || busy) return;
    setBusy(true);
    setActionError(null);
    setWaiting(false);
    try {
      const outcome = await performSequentialDraw({
        repo,
        drawId,
        token,
        uid: getBrowserUid(),
        onPhase: setPhase,
      });
      if (outcome === "busy") setWaiting(true);
      // 'committed' oraz 'already-committed': odczyt ze stanu pokaże wynik.
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Losowanie nie udało się.");
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }, [repo, privateKey, busy, drawId, token]);
  drawRef.current = () => void doDraw();

  // Zajęta blokada: oczekiwanie z automatyczną ponowną próbą (onSnapshot/polling).
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setWaiting(false);
      drawRef.current();
    }, 1800);
    return () => clearTimeout(timer);
  }, [waiting]);

  const namesKey = draw?.roster.map((p) => p.name).join("|") ?? "";
  const names = useMemo(() => (namesKey ? namesKey.split("|") : []), [namesKey]);
  const rescueLink = privateKey
    ? absoluteHash(`d/${drawId}?t=${token}&k=${encodeKeyForUrl(privateKey)}`)
    : null;

  if (loading && !snapshot) return <Card><Spinner label="Ładowanie Twojego losowania…" /></Card>;
  if (error && !snapshot) return <Card><Notice tone="error">{error}</Notice></Card>;
  if (!draw || !me) {
    return (
      <Card>
        <Notice tone="error">
          Nie znaleziono tego losowania lub link jest niepełny. Poproś administratora o ponowne przesłanie linku.
        </Notice>
      </Card>
    );
  }

  const joined = draw.roster.filter((p) => p.claimed).length;
  const finished = draw.roster.filter((p) => p.hasResult).length;

  return (
    <div className="space-y-6">
      <Card className="border-[rgba(217,164,65,0.45)] bg-gradient-to-br from-white/95 to-[#fff8e8]/95">
        <Badge tone={draw.status === "done" ? "green" : draw.status === "running" ? "gold" : "grey"}>
          {draw.status === "lobby" ? "Lobby" : draw.status === "running" ? "Losowanie trwa" : "Zakończone"}
        </Badge>
        <h1 className="display-font mt-3 text-3xl font-bold text-[var(--pine-dark)] sm:text-4xl">
          Cześć, {me.name}! 🎁
        </h1>
        <p className="mt-2 text-sm text-[#4a655b]">{draw.title}</p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Osób" value={draw.roster.length} />
          <Stat label="Dołączyło" value={joined} />
          <Stat label="Ma wynik" value={finished} />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[rgba(18,68,51,0.1)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#176149] to-[#d9a441] transition-all"
            style={{ width: `${(finished / draw.roster.length) * 100}%` }}
          />
        </div>
      </Card>

      {keyError && <Notice tone="error">{keyError}</Notice>}
      {actionError && <Notice tone="error">{actionError}</Notice>}
      {(phase || waiting) && (
        <Notice tone="info">
          {waiting
            ? "🔒 Ktoś w tej chwili losuje. Czekam… za chwilę spróbuję ponownie automatycznie."
            : phase}
        </Notice>
      )}

      {result ? (
        <Card className="border-[rgba(178,58,72,0.35)]">
          <SectionTitle
            eyebrow="Twój wynik"
            title="Kupujesz prezent dla…"
            description="Wynik został trwale zapisany jako szyfrogram i odszyfrowany wyłącznie Twoim kluczem prywatnym."
          />
          <RevealAnimation
            names={names}
            seedLabel={me.animation?.seedLabel ?? animationSeed(draw.seed, me.id, 0)}
            target={result.receiver ?? "?"}
          />
          <p className="mt-5 text-center text-sm text-[#4a655b]">
            Zachowaj tajemnicę! 🤫 Nie pokazuj tego ekranu osobie, dla której kupujesz prezent.
          </p>
        </Card>
      ) : !privateKey ? (
        <Card><Spinner label="Generuję parę kluczy RSA w Twojej przeglądarce…" /></Card>
      ) : draw.status === "lobby" ? (
        <Card>
          <SectionTitle
            eyebrow="Lobby"
            title="Czekamy na resztę grupy"
            description="Twój klucz publiczny jest już zapisany. Administrator uruchomi losowanie, gdy wszyscy dołączą."
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {draw.roster.map((person) => (
              <li
                key={person.id}
                className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-[var(--pine-dark)]">
                  {person.id === me.id ? `${person.name} (Ty)` : person.name}
                </span>
                <Badge tone={person.claimed ? "green" : "grey"}>
                  {person.claimed ? "✓ gotowy" : "○ czeka"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : draw.status === "running" ? (
        <Card className="text-center">
          <div className="gift-pulse text-6xl" aria-hidden="true">🎁</div>
          <SectionTitle
            eyebrow="Twoja kolej"
            title="Gotowy na losowanie?"
            description="Blokada na 20 sekund chroni przed kolizją. Wynik zobaczysz dopiero po potwierdzeniu zapisu."
          />
          <Button
            variant="red"
            onClick={() => void doDraw()}
            disabled={busy || waiting || !me.claimed}
            type="button"
          >
            {busy || waiting ? "Losowanie w toku…" : "🎉 Losuję!"}
          </Button>
          {(busy || waiting) && <div className="mt-4 flex justify-center"><Spinner label="Bezpieczny zapis wyniku…" /></div>}
          {!me.claimed && (
            <p className="mt-3 text-xs text-[#8a6c1c]">Trwa przygotowanie Twojego klucza…</p>
          )}
        </Card>
      ) : (
        <Card>
          <Notice tone="info">
            Losowanie jest zakończone, ale brakuje wyniku dla tego linku. Skontaktuj się z administratorem.
          </Notice>
        </Card>
      )}

      {rescueLink && (
        <Card>
          <SectionTitle
            eyebrow="Kopia zapasowa"
            title="Link ratunkowy"
            description="Zawiera Twój klucz prywatny w hashu URL. Użyj go po zmianie urządzenia lub wyczyszczeniu danych przeglądarki. Przechowuj go tak samo bezpiecznie jak link do wyniku."
          />
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-white/70 px-3 py-2 text-xs text-[#436156]">
              {rescueLink}
            </code>
            <CopyButton value={rescueLink} label="Kopiuj link ratunkowy" />
          </div>
        </Card>
      )}
    </div>
  );
}

async function decryptResult(
  cipher: string,
  privateKey: JsonWebKey,
): Promise<DecryptedResult> {
  const plain = await decryptWith(privateKey, cipher);
  return JSON.parse(plain) as DecryptedResult;
}
