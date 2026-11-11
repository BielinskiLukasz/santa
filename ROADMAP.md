# ROADMAP: Generator losowania prezentów (Secret Santa)

> Status po implementacji. Szczegóły: [README.md](README.md), [docs/ALGORITHM.md](docs/ALGORITHM.md),
> [docs/SECURITY.md](docs/SECURITY.md), [docs/FIREBASE.md](docs/FIREBASE.md).

| Faza | Nazwa | Status | Uwagi |
|---|---|---|---|
| 0 | Szkielet repo i deploy | ✅ | Next.js + TS, `output: 'export'` warunkowo, `basePath`, CI (Vitest + Pages), `.nojekyll` |
| 1 | Silnik losowania | ✅ | `src/engine` bez zależności, 14 testów + test statystyczny |
| 2 | Firebase: projekt, model danych, reguły | ✅ | `firestore.rules`, `firebase.json` (emulatory), warstwa `/firebase`, scenariusze testowe w docs |
| 3 | Kryptografia i dołączanie | ✅ | RSA-OAEP 2048, JWK w localStorage, link ratunkowy, kopie dla admina, lobby |
| 4 | Blokada losowania (lease lock) | ✅ | transakcja, `serverTimestamp`/`now()`, 20 s, `epoch`, margines 15 s, auto retry |
| 5 | Przepływ losowania jednej osoby | ✅ | `drawService.ts`, atomowy commit, dolosowanie ogona, idempotencja, wynik po zapisie |
| 6 | Panel admina i ograniczenia | ✅ | formularz, macierz skierowana, import poprzedniego roku, walidacja na żywo, status i linki |
| 7 | Animacja i dopracowanie UI | ✅ | `RevealAnimation`, replay własny i całości, PL, mobile-first, reduced motion |
| 8 | Dokumentacja i demo | ✅ | README, opis algorytmu/bezpieczeństwa/Firebase, CI Pages, licencja MIT |
| 9 | Tryb „admin losuje wszystko naraz" | ✅ | `runFullDraw` + `draw-all`, ten sam silnik i szyfrowanie |

## Założenia zrealizowane

- Hosting: statyczny `out/` na GitHub Pages; parametry wyłącznie w hashu URL.
- Backend: Firebase Spark (Firestore + Anonymous Auth), **bez Cloud Functions**.
- Alternatywny adapter lokalny (Next.js + PostgreSQL/Drizzle) o identycznym kontrakcie
  umożliwia uruchomienie demonstracji bez konta Firebase.
- Do 10 osób, link capability z 128-bitowym tokenem, blokada `list` w regułach.
- Losowanie sekwencyjne z ważonym wyborem i dolosowaniem jednoznacznego ogona.
- Wyniki w bazie wyłącznie jako szyfrogramy; admin widzi je tylko przy `adminSeesAll`.
- Koszt: 0 zł, bez karty.

## Świadomie zaakceptowane granice

1. **Reguły nie uruchamiają silnika** — zgodność wyboru z zakazami weryfikuje klient
   (i dodatkowo serwer w adapterze lokalnym). Reguły pilnują blokady, epoki, unikalności
   odbiorcy i braku ponownego losowania. Zmodyfikowany klient mógłby ominąć zakazy:
   akceptowalne dla zabawy rodzinnej, opisane w `docs/SECURITY.md`.
2. **Kto ma link, ten widzi wynik** — capability URL, bez logowania.
3. **Utrata obu linków** (zwykłego i ratunkowego) oznacza brak możliwości odczytu wyniku.
4. Testy reguł na emulatorze są opisane jako scenariusze do uruchomienia lokalnie
   (`firebase emulators:exec`); w CI działają testy jednostkowe czystego silnika i kryptografii.

## Definicja ukończenia — checklista

- [x] Admin tworzy losowanie, definiuje ograniczenia i rozsyła linki
- [x] Uczestnicy losują pojedynczo, bez możliwości kolizji
- [x] Wynik pojawia się dopiero po trwałym zapisie
- [x] Nikt nie zostaje bez możliwości wylosowania; jedna kombinacja ⇒ dolosowanie reszty
- [x] Widoczność wyników dla admina zgodna z wyborem przy tworzeniu
- [x] Animacja odsłaniania działa na telefonie
- [x] Całość działa na GitHub Pages i Firebase Spark, bez kosztów
