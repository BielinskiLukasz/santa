# PHASE-5 — Przebieg wydarzenia

**Rozmiar:** L. **Zależy od:** 2, 3, 4. **Specyfikacje:** `UI-SPEC`, `SECURITY-SPEC` §6–7, `ENGINE-SPEC`.
**Cel:** pełny przebieg od odblokowania do zakończenia: wpisanie wspólnie ustalonego budżetu, losowanie z ceremonią, tryb "zasłoń", pomoc `?`.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Wpisanie wspólnie ustalonej kwoty na prezent | Dźwięk (faza 6), głosowanie nad budżetem |
| Ceremonia losowania (kapelusz, koperta, pieczęć) | QR i dwa okna (faza 8) |
| Tryb "zasłoń" i przytrzymanie | |
| Wskazywanie, kto losuje | |
| Podgląd admina | |
| Cofnięcie ostatniego przydziału i ponowne losowanie | |
| Przycisk `?` z instrukcją | |
| Podsumowanie i zakończenie | |

## 2. Zadania

### 2.1 Budżet
- [x] Przejście `SETUP` → `BUDGET`, przypomnienie o wspólnym ustaleniu kwoty na jeden prezent
- [x] Operator wpisuje jedną kwotę dla wszystkich; walidacja skonfigurowanego zakresu, domyślnie 10–2000, liczby całkowite
- [x] Po zatwierdzeniu tablica pokazuje kwotę bez przeliczania i zaokrąglania; brak poprawnej kwoty blokuje losowanie
- [x] Walidacja startowa rozwiązywalności reguł przy przejściu do `DRAWING`, komunikat tylko dla Operatora w strefie admina

### 2.2 Losowanie
- [x] Wskazanie zwierzątka (klik, klawiatura, "Następne w kręgu")
- [x] Ceremonia: podejście do kapelusza, wyciągnięcie koperty (widoczna tylko pieczęć), uniesienie koperty
- [x] Wywołanie `drawFor` z silnika; przydział i `revealCompleted = false` trwale zapisane przed ujawnieniem
- [x] Zatrzask akcji do końca ceremonii (odporność na podwójne kliknięcie)
- [x] Wymuszone losowania obsługiwane identycznie, bez oznaczeń w UI

### 2.3 Tryb "zasłoń"
- [x] Karta "Teraz losuje {imię}. Reszta odwraca wzrok." + "Jestem gotowy/a"
- [x] Wynik tylko podczas przytrzymania (mysz, `Spacja`/`Enter`, dotyk), natychmiastowe ukrycie po puszczeniu, auto-ukrycie po 10 s
- [x] "Zamknij", utrata fokusu nakładki lub okna/karty i odświeżenie kończą sesję; `revealCompleted = true` blokuje ponowny wgląd poza podglądem admina
- [x] Po odświeżeniu lub awarii przerwany przydział z `revealCompleted = false` jest oznaczany jako zakończony przed dostępem do interfejsu
- [x] Brak wyniku w DOM, tytule karty, URL i logach poza trwaniem przytrzymania

### 2.4 Podsumowanie i pomoc
- [x] Zakończenie, gdy wszyscy wylosowali: zapalenie światełek, spokojne podsumowanie bez wyników
- [x] Przycisk `?` na każdym ekranie, zawartość z `UI-SPEC` §7
- [x] Podgląd admina (gdy włączony): hasło, lista par w strefie admina
- [x] Cofnięcie tylko ostatniego przydziału po haśle i potwierdzeniu: A może losować ponownie, B wraca do puli; bez publicznego ujawnienia B
- [x] Cofnięcie z `DONE` wraca do `DRAWING`; budżet i pozostałe przydziały zostają bez zmian

### 2.5 Dopasowanie
- [x] Odporność na odświeżenie w każdej fazie (odtworzenie z zapisu po haśle)
- [x] Dostępność: fokus, `aria-live`, obsługa klawiatury

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Komponentowe | Budżet, tryb "zasłoń" (przytrzymanie, puszczenie, auto-ukrycie, utrata fokusu), blokada podwójnego kliknięcia |
| E2E (Playwright, ścieżka główna) | Odblokowanie → konfiguracja (7 osób) → wpisanie budżetu → losowanie wszystkich → podsumowanie |
| Prywatność | W DOM w trakcie ceremonii (poza przytrzymaniem) brak imienia obdarowanego |
| Odświeżenie | Postęp zachowany, przerwana sesja ujawnienia zakończona i niemożliwa do ponownego otwarcia przez uczestnika |
| Cofnięcie | Tylko ostatni przydział, wolny odbiorca, ponowne losowanie i powrót z `DONE` do `DRAWING` |

## 4. Kryteria akceptacji
- [x] Pełny przebieg działa dla 7 i dla 12 uczestników; mniej niż 7 nie rozpoczyna wydarzenia
- [x] Informacja "kto dla kogo" pojawia się tylko podczas przytrzymania lub w uprawnionym podglądzie admina
- [x] Odświeżenie zachowuje postęp i kończy aktywną sesję ujawnienia
- [x] Ostatnie losowanie można cofnąć i powtórzyć bez naruszenia innych przydziałów
- [x] Instrukcja `?` obejmuje wszystkie sterowania

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Najbardziej złożona faza | Wersja minimalna ceremonii najpierw (bez dopieszczenia ruchu), animacje później w fazie 6 |
| Wynik zdradzony przez ruch lub opis dla czytników | Przegląd wszystkich komunikatów i animacji pod kątem wycieku |
| Wyścigi stanów animacji i reduktora | Maszyna stanów jako jedyne źródło prawdy, animacje tylko reagują |