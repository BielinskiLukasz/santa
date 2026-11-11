# Opis algorytmu losowania

Implementacja: `src/engine` (zero importów z UI, bazy, Firebase czy Node). Testy: `tests/engine.test.ts`.

## 1. Macierz dozwolonych par

Dla `n ≤ 10` osób budujemy macierz `allowed[i][j] ∈ {0,1}`:

- `allowed[i][i] = 0` — nikt nie kupuje sobie,
- `allowed[i][j] = 0` dla każdego **skierowanego** zakazu `[A, B]`,
- kolumny odbiorców już wylosowanych są wyłączane maską bitową `takenMask`.

Zakaz `A → B` nie zmienia `allowed[B][A]` — małżeństwa i poprzednie losowania można więc
modelować precyzyjnie (para może być zakazana tylko w jedną stronę, choć w praktyce najczęściej
dodaje się obie).

## 2. Zliczanie poprawnych dopełnień

Liczba poprawnych przypisań to **permanent macierzy 0/1**. Zamiast wyliczać go z definicji
(`n!` permutacji), używamy DP po maskach bitowych:

```
f(mask) = liczba dopełnień, gdy zajęci odbiorcy opisani są maską,
          a następna osoba do przypisania wynika z liczby wolnych kolumn.
f(mask) = Σ  f(mask | 1<<j)   dla j wolnych i allowed[i][j] = 1
```

- stanów: `2^n` (≤ 1024), przejść: `O(2^n · n)` (≤ ~10 tys. dla 10 osób),
- memoizacja w `Map<mask, number>`,
- wynik `f(0)` to liczba wszystkich poprawnych losowań (np. `!4 = 9` dla 4 osób).

Ta sama funkcja odpowiada na trzy pytania: „czy w ogóle da się losować?" (walidacja formularza),
„czy po wyborze opcji `j` da się dokończyć?" oraz „ile jest dopełnień" (wagi).

## 3. Ważone losowanie i jednostajność

Dla osoby `i` dostępne są tylko te `j`, dla których `f(mask | 1<<j) > 0`. Wybieramy `j` z
prawdopodobieństwem proporcjonalnym do tej liczby dopełnień:

```
P(i → j) = f(mask | 1<<j) / f(mask)
```

To klasyczna konstrukcja „wybieraj gałąź proporcjonalnie do liczby liści", dająca **rozkład
jednostajny po wszystkich poprawnych przypisaniach** — w przeciwieństwie do naiwnego
„losuj z dozwolonych, cofaj się przy ślepej uliczce". Test statystyczny w `tests/engine.test.ts`
(4500 przebiegów, 9 derangementów dla 4 osób) sprawdza odchylenie < 20% od wartości oczekiwanej.

Konsekwencja: nikt nie zostaje bez opcji. Silnik nigdy nie dopuszcza wyboru, po którym
nie istnieje kompletne, poprawne losowanie.

## 4. Dolosowanie jednoznacznego ogona

Jeśli po wyborze `f(...) = 1`, pozostałe przypisania są wyznaczone jednoznacznie. Zamiast
czekać, aż reszta osób „wylosuje" z jednej opcji, `resolveForcedTail` wyznacza cały ogon,
idąc po kolei po pozostałych osobach i wybierając pierwsze `j` z niezerową liczbą dopełnień.
Wszystkie te wyniki trafiają do **jednego atomowego commitu**, zaszyfrowane kluczami
publicznymi ich właścicieli. Dzięki temu nikt nie musi klikać „Losuję", gdy i tak nie ma wyboru.

## 5. Determinizm i „nagranie"

PRNG `mulberry32` seedowany hashem FNV-1a od `seed | chooser | liczbaDotychczasowychKroków`.
Każda osoba ma własny, powtarzalny strumień losowości, a globalny `seed` jest zapisany w
dokumencie losowania. Ten sam seed + dane ⇒ ten sam przebieg (test odtwarzalności).

Animacja korzysta z `animationSeed(seed, giver, index)` oraz wspólnego logu kroków
`steps[]`, który zawiera **wyłącznie** `giver`, `seedLabel`, listę kandydatów (imiona wszystkich
osób), liczbę dolosowanych wyników i czas. Nie ma tam wybranego odbiorcy: cel zna tylko
właściciel klucza prywatnego, który odszyfrowuje go z bazy. „Nagranie" jest więc odtwarzalne,
ale nie ujawnia wyników osobom nieuprawnionym.

## 6. Walidacja wejścia

`validateDrawInput` przy tworzeniu sprawdza: 2–10 osób, unikalne id, niepuste imiona,
poprawność końców zakazów oraz `f(0) > 0`. Dzięki temu admin od razu widzi komunikat
„Dla tych zakazów nie istnieje żadne poprawne losowanie" i liczbę dostępnych przypisań.
Serwer (adapter lokalny) oraz klient Firestore powtarzają walidację wyboru przy commicie.
