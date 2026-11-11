"use client";

import { useEffect, useRef, useState } from "react";
import { mulberry32 } from "@/engine";
import { Button } from "@/features/ui";

/**
 * „Nagranie" odtwarzane lokalnie z seeda i kolejności kroków.
 * Wspólny log kroków nie zawiera wyniku – cel zna tylko właściciel klucza.
 */
export default function RevealAnimation({
  names,
  seedLabel,
  target,
  onDone,
  compact = false,
}: {
  names: string[];
  seedLabel: number;
  target: string | null;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [runId, setRunId] = useState(0);
  const [display, setDisplay] = useState("…");
  const [spinning, setSpinning] = useState(true);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || names.length === 0) {
      setDisplay(target ?? "?");
      setSpinning(false);
      doneRef.current?.();
      return;
    }
    setSpinning(true);
    setDisplay(names[0] ?? "…");
    const rng = mulberry32(seedLabel);
    let step = 0;
    const total = 20;
    const timer = setInterval(() => {
      step += 1;
      if (step >= total) {
        clearInterval(timer);
        setDisplay(target ?? "?");
        setSpinning(false);
        doneRef.current?.();
      } else {
        setDisplay(names[Math.floor(rng() * names.length)] ?? "…");
      }
    }, 85 + Math.round(rng() * 30));
    return () => clearInterval(timer);
  }, [names, seedLabel, target, runId]);

  return (
    <div className="text-center">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8aa096]">
        {spinning ? "Losuję…" : "Twój wynik"}
      </div>
      <div className={`reel ${compact ? "!text-xl !min-h-12" : ""}`} aria-live="polite">
        <span className={spinning ? "opacity-70" : "text-[#9b2938]"}>
          {spinning ? `🎁 ${display}` : `🎀 ${display}`}
        </span>
      </div>
      {!spinning && (
        <div className="mt-3">
          <Button
            variant="ghost"
            small
            type="button"
            onClick={() => setRunId((value) => value + 1)}
          >
            ↻ Odtwórz animację
          </Button>
        </div>
      )}
    </div>
  );
}
