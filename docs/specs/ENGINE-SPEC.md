# ENGINE-SPEC — silnik losowania

Czysta TypeScript w `src/engine/`, bez DOM, bez `localStorage`, bez Reacta. Cała losowość i czas wstrzykiwane z zewnątrz.

## 1. Model

| Pojęcie | Opis |
|---|---|
| Participant | `id`, `name`, `animal` (unikalne), kolejność w kręgu |
| Rule | Zakaz jednostronny `giver → receiver` z powodem `COUPLE` / `LAST_YEAR` / `MANUAL` |
| Draw | Przydział `giver → receiver`, zapisany w kolejności losowań; stan ujawnienia jest przechowywany dla każdego przydziału |
| Event | Rok, waluta, faza, budżet |

Para (A, B) to dwa zakazy: A→B i B→A (`COUPLE`). Wynik z zeszłego roku C→D to jeden zakaz C→D (`LAST_YEAR`), D→C zostaje dozwolone.

## 2. Reguły losowania

1. Dowolna permutacja uczestników bez punktów stałych (nikt nie losuje siebie). Wzajemne A→B i B→A dozwolone, jeśli reguły tego nie blokują.
2. Zakazy: pary (obie strony), zeszły rok (jedna strona), ręczne (jedna strona).
3. Kolejność losowania dowolna, wskazuje Operator.
4. Każde losowanie wybiera **równomiernie spośród kandydatów poprawnych**: takich, po których pozostałe osoby nadal da się przydzielić (skojarzenie doskonałe w grafie dwudzielnym).
5. Gdy poprawny kandydat jest tylko jeden, przebieg jest identyczny (brak oznaczania "wymuszone" w interfejsie i w danych zwracanych do UI).
6. Idempotencja: osoba, która już wylosowała, dostaje ten sam zapisany wynik.
7. Cofnięcie usuwa tylko ostatni istniejący przydział A→B, zwalnia B i umożliwia A ponowne losowanie. Następne losowanie może przypaść A albo innej osobie, zgodnie z dowolną kolejnością.
8. Przy ponownym losowaniu B nie jest automatycznie wykluczany: może zostać wybrany ponownie, jeśli jest poprawnym kandydatem. Cofnięcie nie zmienia pozostałych przydziałów ani budżetu.

Uwaga: równomierność dotyczy kandydatów poprawnych w danym kroku, a nie wszystkich możliwych permutacji. To świadoma decyzja (wystarczająca dla prezentów).

## 3. Walidacja startowa

- Interfejs dopuszcza 7–12 uczestników. Walidacja wydarzenia odrzuca mniejsze i większe grupy; przypadki 2 i 3 osób pozostają defensywnymi testami niskopoziomowych algorytmów.
- Sprawdź konfigurację przed `SETUP` → `BUDGET` i ponownie przed `BUDGET` → `DRAWING`.
- Zbuduj graf: krawędź g→r, gdy g ≠ r i para nie jest zakazana.
- Brak skojarzenia doskonałego → blokada przejścia i komunikat dla Operatora w strefie admina: "Reguły są sprzeczne, poluzuj zakazy". Komunikat **nie** ujawnia na ekranie wydarzenia, które osoby są w konflikcie (szczegóły tylko w strefie admina).
- Dodatkowo ostrzeżenie, gdy dla jakiejś osoby zostaje tylko jedna możliwa opcja już na starcie (to sygnał ciasnych reguł).

## 4. Budżet

Uczestnicy uzgadniają kwotę poza aplikacją. Operator wprowadza jedną kwotę na każdy prezent; jest ona jednakowa dla wszystkich. Domyślny dopuszczalny zakres to liczby całkowite 10–2000 w skonfigurowanej walucie; zakres można zmienić w konfiguracji.

Wpisana kwota jest zapisywana bez przeliczania i zaokrąglania. Aplikacja przypomina o wspólnym ustaleniu budżetu i blokuje przejście do losowania bez poprawnej kwoty. Nie ma głosów, mediany ani ich przechowywania.

## 5. Kontrakt (kształt funkcji, bez implementacji)

| Funkcja | Wejście | Wyjście |
|---|---|---|
| `buildGraph` | uczestnicy, zakazy | dozwolone krawędzie |
| `hasPerfectMatching` | graf, wolni giverzy i receiverzy | bool |
| `validateSetup` | uczestnicy, zakazy | ok lub lista problemów (do strefy admina) |
| `validCandidates` | stan, giver | lista receiverów |
| `drawFor` | stan, giver, RNG | nowy stan + wynik |
| `undoLastDraw` | stan z uporządkowanymi przydziałami | stan bez ostatniego przydziału lub informacja, że nie ma czego cofnąć |
| `validateBudget` | kwota i skonfigurowany zakres | poprawna kwota lub błąd walidacji |
| `forbiddenFromPairs`, `forbiddenFromLastYear` | dane konfiguracji | lista zakazów |

RNG: interfejs `random(n) → 0..n-1`. Produkcja: `crypto.getRandomValues` (z odrzucaniem dla równomierności). Testy: ziarnisty generator.

## 6. Testy

| Rodzaj | Zakres |
|---|---|
| Jednostkowe | Brak reguł; pary; zeszły rok (jednostronność); ręczne; jedyna opcja; brak rozwiązania; defensywnie 2 i 3 osoby; 7 i 12 osób |
| Porównawcze | Dla n ≤ 7: porównanie z przeszukiwaniem siłowym (czy zbiór poprawnych kandydatów się zgadza) |
| Symulacyjne | Tysiące pełnych przebiegów z losowymi rozwiązywalnymi regułami: unikalni receiverzy, nikt siebie, żaden zakaz złamany, nigdy ślepej uliczki |
| Budżet | Poprawna kwota pozostaje bez zmian; pusta, niecałkowita lub poza zakresem jest odrzucana |
| Idempotencja | Dwa wywołania `drawFor` dla tej samej osoby dają ten sam wynik |
| Cofnięcie | Usunięty jest tylko ostatni przydział; A może losować ponownie, B jest wolny, pozostałe przydziały i budżet pozostają bez zmian |
| Równomierność | Test statystyczny (rozkład wśród poprawnych kandydatów w jednym kroku) |