# PHASE-3 — Konfiguracja (strefa admina)

**Rozmiar:** M. **Zależy od:** 2. **Specyfikacje:** `SECURITY-SPEC` (bramka), `UI-SPEC` §6a, `ENGINE-SPEC`.
**Cel:** Operator przygotowuje wydarzenie przed czasem: uczestnicy, zwierzęta, reguły, zeszły rok, opcje.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Ekrany `LOCKED` (ustawienie i podanie hasła) | Rysunki zwierząt (faza 4) |
| Strefa admina za bramką | Przebieg wydarzenia (faza 5) |
| Uczestnicy, zwierzęta, pary, zakazy, zeszły rok | Dźwięk |
| Walidacja i podsumowanie (liczby, bez nazwisk) | |
| Podgląd admina, kopie, resety (UI) | |

## 2. Zadania

### 2.1 Odblokowanie
- [ ] Pierwsze uruchomienie: ustawienie hasła (powtórzenie, ostrzeżenie o utracie, min. 8 znaków)
- [ ] Kolejne uruchomienia: pole hasła, komunikaty bez ujawniania szczegółów, wskaźnik pracy (PBKDF2)
- [ ] Zapomniane hasło: Reset całości dostępny bez hasła z `LOCKED`, po ostrzeżeniu i wpisaniu `RESET`

### 2.2 Bramka i strefa admina
- [ ] Zębatka (lub przytrzymanie znaku) → ponowne wpisanie hasła → strefa admina na 5 minut bezczynności
- [ ] Strefa nigdy nie jest widoczna na ekranie wydarzenia

### 2.3 Formularze konfiguracji
- [ ] Uczestnicy: dodawanie, edycja imienia, usuwanie; minimum 7, maksimum 12 osób
- [ ] Zwierzęta: unikalne przypisanie, ręczny wybór lub "losuj domyślnie" (podgląd miniaturki)
- [ ] Pary: wybór dwóch osób, zakaz w obie strony
- [ ] Zeszły rok: lista A→B (jednostronne zakazy), wpisywana ręcznie, z walidacją duplikatów (to była permutacja)
- [ ] Zakazy ręczne: jednostronne
- [ ] Waluta i zakres wpisywanej kwoty na prezent (domyślnie 10–2000)
- [ ] Przełącznik "Podgląd admina" z jasnym opisem skutków

### 2.4 Zatwierdzenie
- [ ] `validateSetup` z `ENGINE-SPEC`: sprzeczne reguły blokują zatwierdzenie, komunikat tylko w strefie admina
- [ ] Podsumowanie: liczby (uczestnicy, pary, zakazy), **bez** wyświetlania reguł poza strefą admina
- [ ] Zatwierdzenie przenosi do `BUDGET`, gdzie Operator wpisuje wspólnie uzgodnioną kwotę

### 2.5 Pozostałe
- [ ] Eksport i import kopii (z fazy 2) w UI
- [ ] Reset losowania i Reset całości z potwierdzeniem frazą `RESET`
- [ ] Cofnięcie ostatniego losowania po haśle i potwierdzeniu, bez ujawniania odbiorcy; z `DONE` powrót do `DRAWING`

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Komponentowe | Formularze, walidacja duplikatów zwierząt, odrzucenie 6 i akceptacja 7–12 uczestników |
| Walidacja | Sprzeczne reguły → blokada zatwierdzenia |
| Prywatność | Po zamknięciu strefy admina w DOM nie ma imion powiązanych w pary ani listy reguł |
| Persistencja | Konfiguracja przeżywa odświeżenie (po haśle) |
| Awaryjny reset | Utracone hasło nie blokuje destrukcyjnego Resetu całości po wpisaniu `RESET` |

## 4. Kryteria akceptacji
- [ ] Pełną konfigurację można wprowadzić, zapisać, odtworzyć po odświeżeniu
- [ ] Sprzeczne reguły blokują start
- [ ] Reguły nigdy nie pojawiają się poza strefą admina

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Operator wpisze błędne dane zeszłoroczne | Podgląd przed zapisem, możliwość edycji przed startem |
| Strefa admina wyświetlona przy rodzinie | Timeout 5 min, wyraźny przycisk zamknięcia, ostrzeżenie przy otwieraniu |