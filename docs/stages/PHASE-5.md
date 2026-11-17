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
- [ ] Przejście `SETUP` → `BUDGET`, przypomnienie o wspólnym ustaleniu kwoty na jeden prezent
- [ ] Operator wpisuje jedną kwotę dla wszystkich; walidacja skonfigurowanego zakresu, domyślnie 10–2000, liczby całkowite
- [ ] Po zatwierdzeniu tablica pokazuje kwotę bez przeliczania i zaokrąglania; brak poprawnej kwoty blokuje losowanie
- [ ] Walidacja startowa rozwiązywalności reguł przy przejściu do `DRAWING`, komunikat tylko dla Operatora w strefie admina

### 2.2 Losowanie
- [ ] Wskazanie zwierzątka (klik, klawiatura, "Następne w kręgu")
- [ ] Ceremonia: podejście do kapelusza, wyciągnięcie koperty (widoczna tylko pieczęć), uniesienie koperty
- [ ] Wywołanie `drawFor` z silnika; przydział i `revealCompleted = false` trwale zapisane przed ujawnieniem
- [ ] Zatrzask akcji do końca ceremonii (odporność na podwójne kliknięcie)
- [ ] Wymuszone losowania obsługiwane identycznie, bez oznaczeń w UI

### 2.3 Tryb "zasłoń"
- [ ] Karta "Teraz losuje {imię}. Reszta odwraca wzrok." + "Jestem gotowy/a"
- [ ] Wynik tylko podczas przytrzymania (mysz, `Spacja`/`Enter`, dotyk), natychmiastowe ukrycie po puszczeniu, auto-ukrycie po 10 s
- [ ] "Zamknij", utrata fokusu nakładki lub okna/karty i odświeżenie kończą sesję; `revealCompleted = true` blokuje ponowny wgląd poza podglądem admina
- [ ] Po odświeżeniu lub awarii przerwany przydział z `revealCompleted = false` jest oznaczany jako zakończony przed dostępem do interfejsu
- [ ] Brak wyniku w DOM, tytule karty, URL i logach poza trwaniem przytrzymania

### 2.4 Podsumowanie i pomoc
- [ ] Zakończenie, gdy wszyscy wylosowali: zapalenie światełek, spokojne podsumowanie bez wyników
- [ ] Przycisk `?` na każdym ekranie, zawartość z `UI-SPEC` §7
- [ ] Podgląd admina (gdy włączony): hasło, lista par w strefie admina
- [ ] Cofnięcie tylko ostatniego przydziału po haśle i potwierdzeniu: A może losować ponownie, B wraca do puli; bez publicznego ujawnienia B
- [ ] Cofnięcie z `DONE` wraca do `DRAWING`; budżet i pozostałe przydziały zostają bez zmian

### 2.5 Dopasowanie
- [ ] Odporność na odświeżenie w każdej fazie (odtworzenie z zapisu po haśle)
- [ ] Dostępność: fokus, `aria-live`, obsługa klawiatury

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Komponentowe | Budżet, tryb "zasłoń" (przytrzymanie, puszczenie, auto-ukrycie, utrata fokusu), blokada podwójnego kliknięcia |
| E2E (Playwright, ścieżka główna) | Odblokowanie → konfiguracja (7 osób) → wpisanie budżetu → losowanie wszystkich → podsumowanie |
| Prywatność | W DOM w trakcie ceremonii (poza przytrzymaniem) brak imienia obdarowanego |
| Odświeżenie | Postęp zachowany, przerwana sesja ujawnienia zakończona i niemożliwa do ponownego otwarcia przez uczestnika |
| Cofnięcie | Tylko ostatni przydział, wolny odbiorca, ponowne losowanie i powrót z `DONE` do `DRAWING` |

## 4. Kryteria akceptacji
- [ ] Pełny przebieg działa dla 7 i dla 12 uczestników; mniej niż 7 nie rozpoczyna wydarzenia
- [ ] Informacja "kto dla kogo" pojawia się tylko podczas przytrzymania lub w uprawnionym podglądzie admina
- [ ] Odświeżenie zachowuje postęp i kończy aktywną sesję ujawnienia
- [ ] Ostatnie losowanie można cofnąć i powtórzyć bez naruszenia innych przydziałów
- [ ] Instrukcja `?` obejmuje wszystkie sterowania

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Najbardziej złożona faza | Wersja minimalna ceremonii najpierw (bez dopieszczenia ruchu), animacje później w fazie 6 |
| Wynik zdradzony przez ruch lub opis dla czytników | Przegląd wszystkich komunikatów i animacji pod kątem wycieku |
| Wyścigi stanów animacji i reduktora | Maszyna stanów jako jedyne źródło prawdy, animacje tylko reagują |