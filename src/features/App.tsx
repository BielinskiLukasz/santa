"use client";

import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/firebase";
import AdminCreate from "@/features/admin/AdminCreate";
import AdminDashboard from "@/features/admin/AdminDashboard";
import DrawView from "@/features/draw/DrawView";
import { go, parseHash, type Route } from "@/features/router";
import { Badge, Button, Card, SectionTitle } from "@/features/ui";

function Header() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
      <button
        type="button"
        onClick={() => go("")}
        className="flex items-center gap-2 text-left"
        aria-label="Strona główna"
      >
        <span className="text-2xl" aria-hidden="true">🎁</span>
        <span className="display-font text-lg font-bold text-[var(--pine-dark)] sm:text-xl">
          Sekretny Mikołaj
        </span>
      </button>
      <div className="flex items-center gap-2">
        <Badge tone={isFirebaseConfigured ? "green" : "gold"}>
          {isFirebaseConfigured ? "Firebase Spark" : "Tryb demo · lokalny stan"}
        </Badge>
        <Button variant="ghost" small onClick={() => go("")} type="button">
          Start
        </Button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-8 pt-10 text-center text-xs text-[#5a7268]">
      <p>
        Silnik: DP po maskach bitowych · ważone losowanie · dolosowanie ogona.
        Wyniki wyłącznie jako szyfrogramy RSA-OAEP.
      </p>
      <p className="mt-1">0 zł · bez karty · GitHub Pages + Firebase Spark (plan bezpłatny)</p>
    </footer>
  );
}

function Home() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-[rgba(217,164,65,0.4)] bg-gradient-to-br from-white/95 to-[#fff7e6]/90">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Badge tone="red">Losowanie prezentów · do 10 osób</Badge>
            <h1 className="display-font mt-4 text-[clamp(2.2rem,7vw,4rem)] font-bold leading-[1.05] text-[var(--pine-dark)]">
              Kto komu kupuje<br />
              <span className="text-[#b23a48]">prezent?</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-[#4a655b] sm:text-base">
              Każdy uczestnik losuje sam, po kolei, ze swojego unikalnego linku.
              Wynik jest szyfrowany w przeglądarce i pokazywany dopiero po trwałym
              zapisie. Bez logowania, bez serwera aplikacyjnego, bez kosztów.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => go("create")} type="button">
                ✨ Utwórz losowanie
              </Button>
              <Button variant="ghost" onClick={() => go("create")} type="button">
                Jak to działa ↓
              </Button>
            </div>
          </div>
          <div className="gift-pulse mx-auto text-[6rem] sm:text-[8rem]" aria-hidden="true">
            🎅
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: "🧮",
            title: "Silnik najpierw",
            text: "Zliczanie poprawnych dopełnień (permanent macierzy 0/1) gwarantuje, że nikt nie utknie bez opcji. Losowanie ważone daje rozkład jednostajny.",
          },
          {
            icon: "🔐",
            title: "Prywatność",
            text: "Para kluczy RSA powstaje w przeglądarce. Baza widzi tylko szyfrogramy. Link ratunkowy przenosi klucz prywatny na inne urządzenie.",
          },
          {
            icon: "🔒",
            title: "Bez kolizji",
            text: "Blokada z 20-sekundową dzierżawą, epoka i atomowy commit chronią przed dwoma osobami losującymi w tym samym momencie.",
          },
        ].map((item) => (
          <Card key={item.title} className="h-full">
            <div className="text-3xl" aria-hidden="true">{item.icon}</div>
            <h3 className="display-font mt-3 text-xl font-bold text-[var(--pine-dark)]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#4a655b]">{item.text}</p>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle
          eyebrow="Przebieg"
          title="Trzy kroki do wyniku"
          description="Interfejs prowadzi administratora i uczestników od utworzenia po odsłonięcie wyniku."
        />
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Admin tworzy", "Wpisuje imiona, zaznacza skierowane zakazy, wybiera widoczność wyników i rozsyła unikalne linki."],
            ["2", "Uczestnicy dołączają", "Każdy otwiera swój link, generuje klucz i czeka w lobby, aż wszyscy będą gotowi."],
            ["3", "Losowanie i animacja", "Po kolei, z blokadą czasową. Gdy zostaje jedna kombinacja, reszta jest dolosowywana automatycznie."],
          ].map(([number, title, text]) => (
            <li key={number} className="rounded-2xl bg-white/70 p-4">
              <span className="display-font text-2xl font-bold text-[#b23a48]">{number}.</span>
              <h4 className="mt-1 text-sm font-bold text-[var(--pine-dark)]">{title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#5a7268]">{text}</p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>({ kind: "home" });

  useEffect(() => {
    const read = () => setRoute(parseHash());
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <div className="app-shell">
      <div className="snowfield" aria-hidden="true" />
      <Header />
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
        {route.kind === "home" && <Home />}
        {route.kind === "create" && <AdminCreate />}
        {route.kind === "admin" && (
          <AdminDashboard
            key={`${route.drawId}:${route.adminToken}`}
            drawId={route.drawId}
            adminToken={route.adminToken}
          />
        )}
        {route.kind === "draw" && (
          <DrawView
            key={`${route.drawId}:${route.token}`}
            drawId={route.drawId}
            token={route.token}
            rescue={route.rescue}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
