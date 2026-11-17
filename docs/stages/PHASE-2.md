# PHASE-2 — Stan, zapis i szyfrowanie

**Rozmiar:** M. **Zależy od:** 1. **Specyfikacja:** `docs/specs/SECURITY-SPEC.md`.
**Cel:** maszyna stanów wydarzenia i bezpieczny zapis w `localStorage`, który przeżywa odświeżenie.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Reducer i maszyna stanów (`LOCKED`…`DONE`) | Ekrany |
| Zapis i odczyt zaszyfrowanego bloba | Strefa admina (faza 3) |
| Hasło, PBKDF2, AES-GCM | QR, dwa okna (faza 8) |
| Eksport/import kopii, resety (logika) | |
| Migracje schematu | |

## 2. Zadania

### 2.1 Stan
- [ ] Typ `AppState` (wersja, zdarzenie, uczestnicy, zakazy, zeszły rok, uzgodniony budżet, wyniki w kolejności losowania, `revealCompleted`, ustawienia)
- [ ] Reducer z akcjami: konfiguracja, wpisanie budżetu, losowanie, zakończenie ujawnienia, cofnięcie ostatniego przydziału, resety
- [ ] Reguły przejść faz i ich odmowy (np. brak losowania poza `DRAWING`)
- [ ] Fazy `LOCKED` → `SETUP` → `BUDGET` → `DRAWING` → `DONE`; aplikacja nie przechowuje indywidualnych głosów
- [ ] Po odtworzeniu stanu oznaczyć przerwane sesje ujawnienia jako zakończone, zanim wynik będzie dostępny w interfejsie

### 2.2 Zapis i szyfrowanie
- [ ] Moduł `crypto`: PBKDF2 (SHA-256, ≥ 600 000 iteracji, sól 16 B), AES-256-GCM, IV 12 B, AAD = wersja
- [ ] Pomiar czasu wyprowadzania klucza na słabszym sprzęcie, korekta iteracji (cel do ~1 s)
- [ ] Moduł `storage`: zapis jednego zaszyfrowanego bloba, odczyt z weryfikacją (zły klucz = błąd, bez wycieków)
- [ ] Zapis przy każdej zmianie stanu; debounce tylko dla zmian niekrytycznych. Krytyczne zmiany zapisać przed dopuszczeniem kolejnej akcji
- [ ] Przydział i `revealCompleted = false` trwale zapisać przed ujawnieniem; nie ujawniać wyniku po błędzie zapisu
- [ ] Niewrażliwe ustawienia (wyciszenie) jawnie, osobnym kluczem
- [ ] Migracje: wersjonowanie schematu i funkcje `migrate(vN → vN+1)`

### 2.3 Kopie i resety
- [ ] Eksport: plik z zaszyfrowanym blobem
- [ ] Import: po wpisaniu hasła, z potwierdzeniem nadpisania
- [ ] "Reset losowania" (wyniki i statusy ujawnienia; budżet zostaje) i "Reset całości" (wszystko), obie operacje atomowe
- [ ] Reset całości dostępny również na ekranie `LOCKED` bez hasła, po ostrzeżeniu i wpisaniu `RESET`

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Reducer | Przejścia faz, odmowy, budżet, idempotencja i cofnięcie ostatniego losowania |
| Crypto | Zapis i odczyt, zły klucz, zmiana bajtu szyfrogramu daje błąd, inny AAD daje błąd |
| Storage | Odtworzenie stanu po "odświeżeniu", uszkodzony blob, nieznana wersja |
| Sesja ujawnienia | Trwały zapis przed ujawnieniem; odświeżenie lub przerwanie blokuje ponowne ujawnienie uczestnikowi |
| Prywatność | Przeszukanie surowej zawartości `localStorage`: brak imion, wyników i kwot w postaci jawnej |

## 4. Kryteria akceptacji
- [ ] Stan przeżywa odświeżenie po poprawnym haśle
- [ ] Surowa zawartość `localStorage` nie ujawnia danych
- [ ] Resety i kopie działają i są testowane
- [ ] Testy w CI zielone

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Zbyt wolne PBKDF2 na słabym laptopie | Pomiar i regulacja iteracji, wskaźnik "Odblokowuję…" |
| WebCrypto niedostępne w danym kontekście | Test na `https`, `localhost`, `file://` w fazie 7, czytelny komunikat zastępczy |
| Zgubione hasło | Ostrzeżenie przy ustawianiu, eksport kopii |