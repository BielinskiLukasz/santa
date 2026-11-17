# PHASE-7 — Wydanie: offline, Pages, testy, QA

**Rozmiar:** M. **Zależy od:** 5 (6 opcjonalnie).
**Cel:** aplikacja gotowa na wydarzenie w obu trybach dostawy, z testami i krótką instrukcją.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Build samodzielny `dist/index.html` | QR i dwa okna (faza 8) |
| Wdrożenie na Pages | Nowe funkcje |
| Test ścieżki głównej (Playwright) | |
| QA na telewizorze 16:9 | |
| README i instrukcja wydarzenia | |

## 2. Zadania

### 2.1 Build offline
- [ ] Konfiguracja drugiego buildu `build:offline`: jeden plik HTML z osadzonym JS, CSS i czcionkami (np. wtyczka do pojedynczego pliku, zgodność z Vite 7 do sprawdzenia)
- [ ] Brak jakichkolwiek zapytań sieciowych (test)
- [ ] Rozmiar w budżecie z `ART-SPEC` §7

### 2.2 Zgodność przeglądarek i kontekstów
- [ ] Sprawdzić WebCrypto i `localStorage` na: Pages (`https`), `localhost`, `file://`, w Chrome i Firefox (oraz Safari, jeśli używane)
- [ ] Udokumentować zalecany tryb (Pages lub `localhost`) i ostrzeżenie o `file://` (trwałość danych)
- [ ] Przetestować eksport/import kopii zapasowej jako ścieżkę awaryjną

### 2.3 Testy
- [ ] Playwright: ścieżka główna (odblokowanie, konfiguracja 7 osób, wpisanie budżetu, losowanie, podsumowanie) + tryb "zasłoń" i cofnięcie ostatniego losowania
- [ ] Test z `reduced-motion`
- [ ] CI uruchamia testy i build obu trybów

### 2.4 QA ręczne
- [ ] Próba na docelowym laptopie i telewizorze/projektorze: czytelność z odległości, płynność, dźwięk
- [ ] Przejście całego scenariusza z 12 fikcyjnymi uczestnikami
- [ ] Test odświeżenia i awarii: przerwana sesja ujawnienia jest zakończona, a pozostały postęp zachowany

### 2.5 Dokumentacja
- [ ] README: uruchomienie, tryby dostawy, kopia zapasowa, reset
- [ ] "Scenariusz wydarzenia" (krok po kroku dla Operatora, 1 strona)
- [ ] Tag wydania i wersja

## 3. Kryteria akceptacji
- [ ] Pełny przebieg działa na Pages oraz z pliku offline
- [ ] Testy i builds zielone w CI
- [ ] Próba generalna na docelowym sprzęcie przeszła
- [ ] Instrukcja jest wystarczająca, by uruchomić wydarzenie bez zaglądania w kod

## 4. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| `localStorage` na `file://` niestabilny | Rekomendacja Pages/`localhost`, kopia zapasowa jako plan B |
| Brak internetu u rodziny | Tryb offline z pliku, uruchomienie `localhost` z lokalnego serwera jako alternatywa |
| Telewizor inaczej skaluje obraz | Test na miejscu, możliwość regulacji skali |