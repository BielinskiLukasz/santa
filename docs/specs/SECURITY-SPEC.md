# SECURITY-SPEC — prywatność, zapis i szyfrowanie

## 1. Model zagrożeń (zaufana grupa, wspólny ekran)

| Zagrożenie | Skutek | Mitygacja |
|---|---|---|
| Ktoś zerka na wspólny ekran w trakcie losowania | Ujawniony wynik | Tryb "zasłoń": wynik tylko po przytrzymaniu, auto-ukrycie, brak wyniku w scenie i w tytule karty |
| Ktoś złapie za laptop po losowaniu i klika w cudze zwierzątko | Ujawniony wynik | Wynik widać tylko podczas jego własnej sesji ujawnienia (A4). Ponowny wgląd tylko przez podgląd admina (hasło) |
| Ktoś otwiera narzędzia deweloperskie lub `localStorage` | Odczyt danych | Dane w `localStorage` zaszyfrowane (§3). W pamięci w trakcie sesji są jawne: świadome ograniczenie |
| Zgubione hasło | Utrata danych | Ostrzeżenie, eksport kopii, Reset całości |
| Publiczne repo | Wyciek danych rodziny | Brak prywatnych danych w repo i testach (dane fikcyjne) |
| Zrzut ekranu / zdjęcie ekranu w trybie "zasłoń" | Ujawniony wynik | Poza zakresem (ryzyko społeczne), opis w instrukcji `?` |

## 2. Zasady ogólne

- Brak zapytań sieciowych w trakcie działania. Czcionki i zasoby w paczce.
- Żadnych danych rodziny w kodzie, README, testach, zrzutach ekranu w repo.
- W v1 wyniki nie trafiają do URL, tytułu karty, `console.log`, ani atrybutów DOM. Opcjonalny QR z fazy 8 proponuje wyjątek dla fragmentu URL i wymaga osobnej decyzji o akceptacji ryzyka historii przeglądarki i udostępnienia adresu.

## 3. Szyfrowanie stanu w `localStorage`

| Element | Decyzja |
|---|---|
| Hasło | Wybiera Operator przy pierwszym uruchomieniu (min. 8 znaków). Nie jest zapisywane |
| Klucz | PBKDF2 (SHA-256) z losową solą 16 B, liczba iteracji ≥ 600 000 (dobrana pomiarem na słabszym laptopie, cel: do ~1 s) |
| Szyfr | AES-256-GCM, losowy IV 12 B na każdy zapis, AAD = wersja schematu |
| Zapis | Jeden zaszyfrowany blob: konfiguracja, uzgodniony budżet, uporządkowane wyniki, `revealCompleted` dla przydziałów i zeszły rok. Jawne tylko: wersja schematu, sól, IV, ustawienia niewrażliwe (wyciszenie dźwięku) |
| Weryfikacja hasła | Udane odszyfrowanie (GCM wykrywa zły klucz i modyfikacje) |
| Sesja | Klucz tylko w pamięci, po odświeżeniu trzeba wpisać hasło ponownie |
| Migracje | Wersja schematu w AAD, funkcje migrujące między wersjami |

WebCrypto wymaga kontekstu bezpiecznego: działa na `https` (Pages), `localhost` i (w typowych przeglądarkach) `file://`. W fazie 7 sprawdzamy to na docelowych przeglądarkach.

## 4. Bramka i strefa admina

- "Prosta bramka": ikona zębatki (lub przytrzymanie znaku w rogu) otwiera okno z żądaniem hasła operatora. Z poprawnym hasłem strefa admina otwiera się na 5 minut bezczynności.
- Strefa admina: konfiguracja, podgląd (jeśli włączony), cofnięcie ostatniego losowania, eksport/import, resety.
- Ekran wydarzenia nie pokazuje żadnych reguł, par ani zakazów.
- Przy utracie hasła destrukcyjny Reset całości jest również dostępny z ekranu `LOCKED` bez hasła, po ostrzeżeniu i wpisaniu `RESET`. Nie odzyskuje danych ani nie otwiera strefy admina.

## 5. Resety i kopie

| Operacja | Skutek | Zabezpieczenie |
|---|---|---|
| Cofnięcie ostatniego losowania | Usuwa ostatni przydział A→B i jego status ujawnienia; zwalnia B, A może losować ponownie | Strefa admina po haśle, potwierdzenie bez ujawniania B |
| Reset losowania | Kasuje wyniki i statusy ujawnienia; zostaje konfiguracja i uzgodniony budżet | Potwierdzenie wpisaniem frazy `RESET` |
| Reset całości | Kasuje cały zapis (łącznie z hasłem/solą) | Jw. |
| Eksport | Plik z zaszyfrowanym blobem (ten sam format co w `localStorage`) | Wymaga hasła |
| Import | Wczytuje plik po wpisaniu hasła, nadpisuje stan | Potwierdzenie |

## 6. Tryb "zasłoń" (semantyka)

1. Każdy nowy przydział ma `revealCompleted = false`. Przed pokazaniem prywatnej nakładki przydział i flagę trzeba trwale zapisać w zaszyfrowanym stanie. Błąd zapisu blokuje ujawnienie.
2. Ekran pokazuje pytanie "Teraz losuje {imię}. Reszta odwraca wzrok" i przycisk "Jestem gotowy/a".
3. Wynik pojawia się **tylko dopóki trzymany jest przycisk** (mysz, `Spacja`/`Enter` lub dotyk). Puszczenie natychmiast go ukrywa. Maksymalnie 10 s ciągłego pokazywania; w tej samej aktywnej sesji można przytrzymać ponownie.
4. "Zamknij", utrata fokusu nakładki lub okna/karty oraz odświeżenie kończą sesję: wynik znika, a `revealCompleted` przechodzi na `true`. Zmiana fokusu między elementami tej samej nakładki nie kończy sesji.
5. Po odtworzeniu stanu każdy zapisany przydział z `revealCompleted = false` jest traktowany jako przerwana, zakończona sesja i oznaczany jako `true` przed udostępnieniem interfejsu. Chroni to również przed zamknięciem karty przed zapisem zakończenia.
6. Przy `revealCompleted = true` uczestnik nie może ponownie ujawnić tego przydziału; wgląd jest możliwy tylko w strefie admina, jeśli podgląd został wcześniej włączony. Cofnięcie ostatniego losowania usuwa przydział, a kolejne losowanie tworzy nową sesję.

## 7. Podgląd admina

- Domyślnie wyłączony. Włączany w konfiguracji świadomie (z opisem, że Operator będzie mógł zobaczyć wszystkie wyniki).
- Wymaga ponownego wpisania hasła, wyświetla listę par w strefie admina, nigdy w scenie.

## 8. Faza 8 (opcjonalnie)

| Funkcja | Opis |
|---|---|
| Kod QR z wynikiem | Propozycja: podczas aktywnej sesji "zasłoń" kod z adresem aplikacji i danymi wyniku po `#` (fragment nie trafia do serwera). Kod znika po puszczeniu i nie otwiera ponownie zakończonej sesji. Wyjątek od zakazu wyniku w URL i ryzyko zapisania adresu wymagają akceptacji przed implementacją |
| Tryb dwóch okien | Okno prezentacji (telewizor) pokazuje scenę, okno Operatora (laptop) pokazuje sterowanie i prywatne ujawnienie. Komunikacja przez `BroadcastChannel` w obrębie tego samego źródła. Rozwiązuje problem wspólnego ekranu, o ile przeglądarka na to pozwala (nie dotyczy każdego `file://`) |