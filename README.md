# Zwierzęta losują

[![CI](https://github.com/BielinskiLukasz/santa/actions/workflows/ci.yml/badge.svg)](https://github.com/BielinskiLukasz/santa/actions/workflows/ci.yml)

Statyczna aplikacja planowana do rodzinnego losowania prezentów. Dostępna jest strona startowa oraz niezależne moduły silnika, stanu i szyfrowanego zapisu. Ekrany konfiguracji i wydarzenia nie są jeszcze zaimplementowane.

## Uruchomienie

Wymagany jest Node.js 20.19+, 22.13+ albo 24+; zalecany jest aktualny Node 22 LTS.

```bash
npm install
npm run dev
```

Adres serwera pojawi się w terminalu. Pierwsze `npm install` utworzy `package-lock.json`; plik należy dodać do repozytorium, aby kolejne instalacje mogły używać `npm ci`.

## Kontrole

```bash
npm run typecheck
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Źródło strony, style i kod interakcji znajdują się w `index.html`. Vite buduje stronę do `dist/index.html`. TypeScript sprawdza konfigurację, testy i przygotowane teksty w `src/i18n/pl.ts`; kod JavaScript osadzony w HTML sprawdza ESLint. Teksty strony startowej są obecnie wpisane bezpośrednio w HTML.

Strona startowa korzysta z Tailwind Browser CDN oraz zewnętrznych czcionek. Nie jest to jeszcze wydanie bez dostępu do sieci, które zaplanowano w fazie 7.

## Silnik losowania

Moduł `src/engine/index.ts` udostępnia typy i czyste funkcje do budowania reguł, walidacji, sprawdzania skojarzenia doskonałego, losowania i cofnięcia ostatniego przydziału. `validateSetup` wymaga 7–12 osób; niskopoziomowe algorytmy obsługują mniejsze grafy dla testów defensywnych. `validateBudget` sprawdza jedną ustaloną kwotę, bez przeliczania ani zaokrąglania.

Losowość jest przekazywana jawnie: w produkcji użyj `createCryptoRandom(globalThis.crypto)`, natomiast `createSeededRandom` służy wyłącznie do powtarzalnych testów. `drawFor` nie zmienia otrzymanego stanu, a ponowne wywołanie dla tej samej osoby zwraca zapisany wynik. `undoLastDraw` usuwa wyłącznie ostatni przydział. Zmiany faz i kontrolę prywatnego ujawnienia obsłużą kolejne etapy.

Przykład z fikcyjnymi uczestnikami:

```ts
import { createCryptoRandom, drawFor, validateSetup, type EventState } from './src/engine';

const participants = Array.from({ length: 7 }, (_, index) => ({
  id: `p${index}`,
  name: `Osoba ${index + 1}`,
  animal: `animal-${index}`,
}));
const state: EventState = {
  event: { year: 2026, currency: 'PLN', phase: 'DRAWING', budget: 100 },
  participants,
  rules: [],
  draws: [],
};
if (!validateSetup(state.participants, state.rules).ok) throw new Error('Niepoprawna konfiguracja');
const result = drawFor(state, 'p0', createCryptoRandom(globalThis.crypto));
```

`result.draw` i `result.state` zawierają poufne przydziały. Nie należy ich zapisywać w logach ani pokazywać na publicznym ekranie. Szyfrowanie zapewnia moduł fazy 2; kontrola prezentacji wyniku należy do kolejnych faz.

`npm run test` obejmuje przypadki brzegowe, porównanie z przeszukiwaniem siłowym oraz symulacje pełnych losowań.

## Stan i szyfrowany zapis

`src/state/` zawiera reduktor, walidację stanu i mechanizm rejestrowania migracji schematu. Bieżąca wersja zapisu to 1; ponieważ nie istnieje wcześniejszy oficjalny format, migracje starszych wersji trzeba jawnie dostarczyć. `LOCKED` oznacza zamkniętą sesję magazynu, a zaszyfrowany stan zachowuje ostatnią fazę od `SETUP` do `DONE`.

`src/storage/` udostępnia `SecureEventStore`. Hasło o długości co najmniej 8 znaków jest używane z PBKDF2-SHA-256 (co najmniej 600 000 iteracji) do wyprowadzenia niewyciągalnego klucza AES-256-GCM. Przy zakładaniu hasła liczbę iteracji można dobrać pomiarem na danym urządzeniu (`calibratePbkdf2Iterations`, cel do ok. 1 s); jest wtedy zapisywana w kopercie zapisu, a jej brak oznacza domyślne 600 000. Zapis zawiera jedynie wersję, sól, IV, opcjonalną liczbę iteracji i szyfrogram; wyciszenie jest trzymane osobno. Każda zmiana jest zapisywana kolejno, a nowy wynik jest zwracany dopiero po udanym zapisie.

```ts
import { createInitialState } from './src/state';
import { SecureEventStore } from './src/storage';

const store = new SecureEventStore(window.localStorage, window.crypto);
// W aplikacji hasło podaje operator; nie zapisuj go w kodzie.
const password = 'haslo-tylko-do-przykladu';
const state = store.hasSavedState()
  ? await store.unlock(password)
  : await store.initialize(password, createInitialState(2026));
```

`dispatch` obsługuje konfigurację, budżet i zakończenie ujawnienia. `draw` wymaga źródła losowości; `undoLastDraw` i `resetDrawing` wymagają ponownego hasła i potwierdzenia. `exportBackup` i `importBackup` pracują na zaszyfrowanym tekście; nadpisanie wymaga potwierdzenia. `resetAll('RESET')` usuwa zapis także przy zablokowanej sesji. Po odblokowaniu przerwane ujawnienie jest oznaczane jako zakończone, zanim stan zostanie zwrócony.

Stan zwracany przez magazyn pozostaje jawny w pamięci aktywnej sesji. Przyszły interfejs musi natychmiast usuwać wynik z ekranu i wywoływać `COMPLETE_REVEAL` po zamknięciu lub utracie fokusu; obsługa zdarzeń interfejsu należy do fazy 5. Jednoczesne korzystanie z wielu kart nie jest wspierane; magazyn wykrywa zmianę zapisu, ale `localStorage` nie zapewnia transakcji między kartami.

## GitHub Pages

1. Wypchnij zmiany do repozytorium i uruchom workflow `CI`.
2. W ustawieniach repozytorium wybierz **Settings → Pages → Build and deployment → GitHub Actions**.
3. Po udanym `CI` wywołanym przez push do `main` workflow `Deploy Pages` opublikuje sprawdzony commit. Workflow można również uruchomić ręcznie na `main`.
4. W **Settings → Branches** skonfiguruj ochronę `main` i wymagaj zakończenia kontroli `CI / checks` przed scaleniem.

Vite używa względnej ścieżki bazowej `./`, dzięki czemu build można udostępnić w katalogu repozytorium na Pages. Ustawienia repozytorium, ochrony gałęzi i publikacja wymagają uprawnień właściciela.

## Dokumentacja

- [Opis projektu](planning/PROJECT.md)
- [Harmonogram](planning/ROADMAP.md)
- [Specyfikacje](docs/specs/)
- [Plany faz](docs/stages/)