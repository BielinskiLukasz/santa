# 🎁 Sekretny Mikołaj — generator losowania prezentów

Aplikacja do losowania, kto komu kupuje prezent. **Każdy uczestnik losuje osobno ze swojego
unikalnego linku**, a wynik widzi tylko on (opcjonalnie także admin). Frontend jest statyczny
(GitHub Pages), a współdzielony stan trzyma Firebase Spark — bez Cloud Functions i bez karty
płatniczej.

> Zasada prowadząca: **silnik najpierw, potem backend, na końcu UI**. `src/engine` to czysty
> moduł TypeScript bez żadnych zależności, w pełni przetestowany.

![Zrzut ekranu aplikacji](docs/screenshot.png)

## ✨ Co działa

- **Silnik**: macierz dozwolonych par, zliczanie poprawnych dopełnień (permanent macierzy 0/1)
  programowaniem dynamicznym po maskach bitowych, losowanie ważone liczbą dopełnień
  (rozkład jednostajny po poprawnych przypisaniach), dolosowanie jednoznacznego ogona,
  deterministyczny PRNG (mulberry32 + FNV-1a).
- **Skierowane zakazy**, import wyników zeszłego roku jako zakazów, walidacja istnienia
  rozwiązania na żywo już w formularzu tworzenia (2–10 osób).
- **Kryptografia**: RSA-OAEP 2048 / WebCrypto. Klucz prywatny zostaje w przeglądarce,
  w bazie są wyłącznie szyfrogramy. Dodatkowa kopia dla admina tylko przy `adminSeesAll`.
  Link ratunkowy przenosi klucz prywatny w hashu URL.
- **Blokada lease 20 s** z `epoch` i atomowym commitem: przejęcie w transakcji, świeży odczyt
  `takenReceivers`, zapis wyniku + zwolnienie blokady w jednym batchu/transakcji, margines
  15 s po stronie klienta, idempotencja po utracie odpowiedzi.
- **Wynik dopiero po trwałym zapisie**: UI pokazuje wyłącznie wynik odszyfrowany z dokumentu
  w bazie, nigdy z pamięci klienta.
- **Animacja** odsłaniania odtwarzana z seeda i kolejności kroków (bez ujawniania wyników
  w wspólnym logu), powtórka własnego wyniku i odtworzenie całego przebiegu dla admina.
- **Panel admina**: tworzenie, macierz zakazów, status dołączeń/wyników, linki do kopiowania,
  start, wyniki (gdy wybrane) oraz tryb „admin losuje wszystko naraz”.
- **Polski interfejs, mobile-first**, stany ładowania/błędów/oczekiwania, kontrast,
  obsługa klawiatury i `prefers-reduced-motion`.

## 🏗 Architektura

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ GitHub Pages (Next.js export)│◄──────►│ Firebase Spark               │
│ - src/engine  (czysty TS)    │        │ - Firestore (stan)           │
│ - src/crypto  (WebCrypto)    │        │ - Anonymous Auth             │
│ - animacja, hash routing     │        │ - firestore.rules            │
└──────────────────────────────┘        └──────────────────────────────┘
```

Wszystkie parametry (kod losowania, token, klucz ratunkowy) są w **hashu URL**, bo GitHub
Pages serwuje tylko pliki:

```
#/a/<drawId>?t=<adminToken>                      panel admina
#/d/<drawId>?t=<token>                          link uczestnika
#/d/<drawId>?t=<token>&k=<privateKeyJwk>         link ratunkowy
```

### Dwa adaptery, jeden kontrakt

`src/firebase/index.ts` wybiera backend:

| Warunek | Adapter | Gdzie |
|---|---|---|
| Ustawiona `NEXT_PUBLIC_FIREBASE_CONFIG` (jeden JSON) | `firebaseRepository` (Firestore + Anonymous Auth) | docelowy deploy na Pages |
| Brak konfiguracji | `localRepository` → `/api/draws/*` (Next.js + PostgreSQL/Drizzle) | lokalne demo i sandbox bez Firebase |

Oba implementują `DrawRepository` z `src/shared/types.ts`, więc UI, silnik i kryptografia
nie zależą od bazy. Lokalny backend odwzorowuje model Firestore 1:1 i dodatkowo **waliduje
zakazy oraz unikalność odbiorcy po stronie serwera**. To wygodny tryb demonstracyjny —
bez zakładania projektu Firebase można przejść całe losowanie.

```
src/
  engine/          czysty TS: types, prng, matrix, draw + testy w tests/
  crypto/          WebCrypto, klucze w localStorage, link ratunkowy
  firebase/        config, wybór adaptera, local.ts, firestore.ts
  server/store.ts  lokalny backend: transakcje SQL, lease lock, walidacja
  features/        App (hash routing), admin/, draw/, hooks, ui
  app/             layout, page, globals.css, API dla trybu demo
  db/schema.ts     tabele Drizzle (draws, participants)
```

## 🚀 Uruchomienie lokalne

```bash
npm install
npm run dev                   # http://localhost:3000
```

**Nie musisz konfigurować żadnych zmiennych środowiskowych.** Jedyna wymagana to
`DATABASE_URL` (platforma sandbox ustawia ją w `.env`; wzór w `.env.example`).
Opcjonalna `NEXT_PUBLIC_FIREBASE_CONFIG` jest potrzebna wyłącznie przy wdrożeniu na
GitHub Pages — to jeden obiekt JSON z konsoli Firebase, nie pięć osobnych kluczy,
i nie jest to sekret (konfiguracja webowa jest jawna w bundle'u).

Tabele w PostgreSQL tworzą się automatycznie przy pierwszym zapytaniu (`ensureTables()`),
opcjonalnie można użyć `npx drizzle-kit push`. Bez konfiguracji Firebase aplikacja działa
od razu w trybie demo.

```bash
npx vitest run                      # 14+ testów silnika i kryptografii
npx tsc --noEmit --pretty false
npm run build
```

Statyczny eksport na GitHub Pages:

```bash
rm -rf src/app/api                 # Pages serwuje tylko pliki
EXPORT_STATIC=1 NEXT_PUBLIC_BASE_PATH=/nazwa-repo npm run build
# wynik: out/index.html (+ .nojekyll z public/)
```

Workflow `.github/workflows/ci.yml` robi to automatycznie: odpala testy, buduje `out/`
i publikuje na GitHub Pages. Konfigurację Firebase przekazuje jako jeden opcjonalny secret
`NEXT_PUBLIC_FIREBASE_CONFIG`.

Szczegółowa instrukcja zakładania projektu Spark: [docs/FIREBASE.md](docs/FIREBASE.md).

## 🧮 Algorytm i bezpieczeństwo

- [docs/ALGORITHM.md](docs/ALGORITHM.md) — uzasadnienie zliczania dopełnień, ważonego
  losowania, dolosowania ogona i odtwarzalności.
- [docs/SECURITY.md](docs/SECURITY.md) — model bezpieczeństwa, reguły, blokada, epoka
  i **jawnie opisane granice** (klient waliduje zakazy, link to capability).

## 🎬 Przepływ jednej osoby

1. Klik „Losuję" → próba przejęcia blokady (zajęta = ekran oczekiwania + auto retry).
2. Świeży odczyt stanu po przejęciu blokady.
3. Silnik liczy dostępne opcje i losuje ważone; przy jednym wariancie dolosowuje resztę.
4. Wyniki szyfrowane kluczami publicznymi właścicieli → **jeden atomowy commit**:
   szyfrogramy, `takenReceivers`, `drawnGivers`, krok animacji, zwolnienie blokady.
5. Dopiero po potwierdzeniu zapisu: odszyfrowanie własnego szyfrogramu i animacja.

Porażka na dowolnym etapie 1–4 jest bezpieczna: lokalny wynik jest odrzucany i nigdy
niepokazywany. Jeśli commit się udał, ale odpowiedź zginęła, ponowna próba wykrywa istniejący
wynik (idempotencja) i odszyfrowuje go z bazy.

## 📄 Licencja

MIT — zobacz [LICENSE](LICENSE).
