# PHASE-1 — Silnik losowania

**Rozmiar:** M. **Zależy od:** 0. **Specyfikacja:** `docs/specs/ENGINE-SPEC.md`.
**Cel:** w pełni przetestowany silnik w czystej TypeScript. Po tej fazie logika losowania jest gotowa i niezależna od UI.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Model, zakazy (pary, zeszły rok, ręczne) | Zapis w `localStorage` (faza 2) |
| Walidacja rozwiązywalności | Interfejs |
| Losowanie dla jednej osoby | Szyfrowanie |
| Walidacja wspólnie ustalonego budżetu | |
| Cofnięcie ostatniego przydziału | |
| RNG (produkcyjny i testowy) | |

## 2. Zadania

- [ ] Typy: `Participant`, `Rule`, `Draw`, `EventState` (tylko dane, bez React)
- [ ] `forbiddenFromPairs` (dwa zakazy na parę), `forbiddenFromLastYear` (jednostronnie)
- [ ] `buildGraph`, `hasPerfectMatching` (algorytm Kuhna)
- [ ] `validateSetup` z listą problemów (identyfikatory osób do strefy admina)
- [ ] `validCandidates`, `drawFor` (równomiernie spośród poprawnych, idempotentne)
- [ ] `validateBudget`: liczba całkowita w skonfigurowanym zakresie, bez przeliczania i zaokrąglania
- [ ] `undoLastDraw`: usuwa ostatni przydział, zwalnia odbiorcę i umożliwia ponowne losowanie
- [ ] RNG: wersja `crypto.getRandomValues` z odrzucaniem oraz wersja ziarnista do testów
- [ ] Walidacja danych wejściowych: 7–12 uczestników w wydarzeniu, duplikaty zwierząt, zakaz "do siebie", pusta lista

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Jednostkowe | Wszystkie przypadki z `ENGINE-SPEC` §6 |
| Porównawcze | n ≤ 7, zgodność z przeszukiwaniem siłowym |
| Symulacyjne | Tysiące przebiegów z losowymi rozwiązywalnymi regułami, 0 ślepych uliczek |
| Budżet | Wartości graniczne, puste i niecałkowite dane; brak zmiany poprawnej kwoty |
| Idempotencja | Powtórne `drawFor` zwraca ten sam wynik |
| Cofnięcie | Wyłącznie ostatni przydział; zwolnienie odbiorcy i poprawne ponowne losowanie |
| Liczba uczestników | Wydarzenie: 7–12; 2 i 3 osoby wyłącznie w defensywnych testach algorytmów |

## 4. Kryteria akceptacji
- [ ] Brak ślepych uliczek i złamanych zakazów w symulacjach
- [ ] Silnik nie importuje Reacta ani DOM
- [ ] Pokrycie testami kluczowych funkcji, CI zielone

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Błąd w algorytmie skojarzeń | Testy porównawcze z siłowym przeszukiwaniem |
| Niejednostajność rozkładu | Opisana w specyfikacji jako świadoma decyzja |