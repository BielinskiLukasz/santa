# PHASE-8 — Dodatki (opcjonalne): QR i tryb dwóch okien

**Rozmiar:** M. **Zależy od:** 5. **Specyfikacja:** `SECURITY-SPEC` §8.
**Cel:** lepsza prywatność przy wspólnym ekranie. Faza opcjonalna, poza linią cięcia MVP.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Kod QR z wynikiem (telefon uczestnika) | Backend, konta |
| Tryb dwóch okien (laptop + telewizor) | Synchronizacja między urządzeniami przez sieć |

## 2. Zadania

### 2.1 Kod QR
- [ ] Generowanie QR lokalnie (mała biblioteka lub własny generator), bez zapytań sieciowych
- [ ] Zawartość: adres aplikacji z danymi wyniku w części po `#` (nie trafia do serwera)
- [ ] Przed implementacją uzgodnić wyjątek od zakazu wyniku w URL oraz ryzyko historii przeglądarki i udostępnienia adresu
- [ ] Strona wyniku na telefonie: tylko odczyt, bez dostępu do reszty danych
- [ ] QR pokazywany tylko podczas przytrzymania w aktywnej sesji "zasłoń" i znikający razem z wynikiem; nie umożliwia ponownego otwarcia zakończonej sesji w aplikacji Operatora
- [ ] Opcja włączana w konfiguracji

### 2.2 Tryb dwóch okien
- [ ] Okno prezentacji (telewizor) pokazuje scenę, bez nakładek prywatnych
- [ ] Okno Operatora (laptop) pokazuje sterowanie i prywatne nakładki
- [ ] Komunikacja przez `BroadcastChannel` w obrębie tego samego źródła, ze stanem scen bez wyników
- [ ] Wykrycie, że kanał nie działa (np. niektóre konteksty `file://`), z czytelnym komunikatem i powrotem do trybu jednego okna

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Jednostkowe | Kodowanie i dekodowanie wyniku w fragmencie URL |
| E2E | Dwa konteksty Playwright: prezentacja nie dostaje żadnych danych o wyniku |
| Prywatność | Komunikaty między oknami nie zawierają wyników |

## 4. Kryteria akceptacji
- [ ] QR otwiera wynik wyłącznie na telefonie osoby i znika razem z wynikiem na ekranie
- [ ] W trybie dwóch okien okno prezentacji nigdy nie otrzymuje danych o wynikach
- [ ] Wyłączenie obu opcji zwraca zachowanie z v1

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Zrzut ekranu QR przez innych | Krótki czas widoczności, ostrzeżenie w pomocy |
| Brak `BroadcastChannel` w danym kontekście | Komunikat i powrót do trybu jednego okna |