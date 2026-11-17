# PROJECT — Zwierzęta losują (pulpit losowania prezentów)

> Dokument opisuje **co** budujemy i **dlaczego**. Harmonogram i indeks dokumentów: `ROADMAP.md`.
> Obecne repo: `santa`. Rekomendowana nazwa: `zwierzeta-losuja`; zmiana nazwy wymaga decyzji właściciela. Status: **tylko planowanie**.

## 1. Cel

Statyczna aplikacja webowa (bez backendu i logowania), którą Operator uruchamia na laptopie i pokazuje rodzinie na telewizorze lub projektorze. Operator **losuje w imieniu każdego uczestnika** kto komu kupuje prezent. Każdy uczestnik to inne zwierzątko przy ognisku na zimowej polanie. Grafika wygląda na ręcznie rysowaną (płaski, "papierowy" storybook) i jest wzorowana na repo `child-train`.

## 2. Założenia przyjęte po wywiadzie

| ID | Założenie | Skąd | Jak zmienić |
|---|---|---|---|
| A1 | Losowanie jest **jawne** (wszyscy widzą ceremonię), ale wynik "kto dla kogo" nigdy nie jest pokazywany publicznie. W v1 uczestnik widzi wynik po **przytrzymaniu** przycisku w trybie "zasłoń" | Odp. 4 i 12 | Faza 8: tryb dwóch okien lub QR |
| A2 | Uczestnicy ustalają budżet poza aplikacją. Operator wpisuje jedną kwotę na każdy prezent; aplikacja przypomina o wspólnym ustaleniu. Głosowania w aplikacji nie ma | Decyzja użytkownika | `UI-SPEC` |
| A3 | Jedno **hasło operatora** odblokowuje aplikację (odszyfrowanie stanu) i wpuszcza do strefy admina | Odp. 6, 7, 8 | `SECURITY-SPEC` |
| A4 | Wynik uczestnika jest dostępny tylko w jednej sesji ujawnienia. Zamknięcie, utrata fokusu lub odświeżenie ją kończą; później wgląd jest możliwy wyłącznie przez włączony podgląd admina | Decyzja użytkownika | `SECURITY-SPEC` §6 |
| A5 | Operator jest uczestnikiem. "Podgląd admina" (wszystkie wyniki) jest opcją wyłączoną domyślnie, włączaną w konfiguracji | Odp. 6 | `SECURITY-SPEC` |
| A6 | Wydarzenie wymaga 7–12 uczestników; mniejsze grupy służą wyłącznie defensywnym testom silnika | Decyzja użytkownika | `ENGINE-SPEC` |
| A7 | Można cofnąć ostatni przydział i ponownie losować dla jego osoby | Decyzja użytkownika | `ENGINE-SPEC`, `UI-SPEC` |

## 3. Role

| Rola | Opis |
|---|---|
| Operator | Uruchamia aplikację, zna hasło, konfiguruje wydarzenie przed czasem, steruje przebiegiem, jest też uczestnikiem |
| Uczestnik | Członek rodziny reprezentowany przez zwierzątko. Nie loguje się. Wynik widzi tylko w trybie "zasłoń" |

## 4. Wymagania funkcjonalne

| ID | Wymaganie |
|---|---|
| FR-1 | Od 7 do 12 uczestników. Każdy: imię + unikalne zwierzątko (przypisanie ręczne, domyślnie losowe) |
| FR-2 | Konfiguracja przed wydarzeniem, za bramką: uczestnicy, pary (zakaz w obie strony), wyniki z zeszłego roku (zakaz jednostronny), zakazy ręczne, waluta |
| FR-3 | Reguły i konfiguracja **nigdy** nie są widoczne na ekranie wydarzenia |
| FR-4 | Przypomnienie o wspólnym ustaleniu budżetu i pole kwoty na jeden prezent. Operator wpisuje kwotę; aplikacja nie prowadzi głosowania ani nie przelicza kwoty |
| FR-5 | Losowanie w dowolnej kolejności (Operator wskazuje zwierzątko). Dowolna permutacja bez losowania siebie. Algorytm gwarantuje, że nikt nie zostanie bez legalnej opcji. Gdy zostaje jedna opcja, osoba "losuje" tę jedyną |
| FR-6 | Ceremonia: zwierzątko wyciąga zapieczętowaną kopertę z kapelusza, publicznie widać tylko pieczęć |
| FR-7 | Tryb "zasłoń": wynik widoczny tylko po przytrzymaniu przycisku, znika po puszczeniu i po 10 s. Flaga `revealCompleted` blokuje wgląd po zamknięciu, utracie fokusu lub odświeżeniu |
| FR-8 | Stan (konfiguracja, budżet, wyniki, statusy ujawnienia, zeszły rok) zapisywany w `localStorage`, **zaszyfrowany**, przeżywa odświeżenie |
| FR-9 | Ręczne zerowanie: "Reset losowania" i "Reset całości", z potwierdzeniem |
| FR-10 | Podgląd admina (opcjonalny, za hasłem) |
| FR-11 | Zimowa, spokojna atmosfera (śnieg, wieczór) i spokojny świąteczny dźwięk, wszystko wyciszalne |
| FR-12 | Przycisk `?` z instrukcją sterowania, dostępny na każdym ekranie |
| FR-13 | Eksport i import zaszyfrowanej kopii zapasowej |
| FR-14 | Dwa tryby dostawy: GitHub Pages oraz samodzielny `dist/index.html` offline |
| FR-15 | (Opcjonalnie) kod QR z wynikiem i tryb dwóch okien |
| FR-16 | Cofnięcie wyłącznie ostatniego istniejącego przydziału A→B: A może losować ponownie, a B wraca do dostępnych odbiorców |

## 5. Wymagania niefunkcjonalne

| ID | Wymaganie |
|---|---|
| NFR-1 | Bez backendu, bez analityki, bez zapytań sieciowych w trakcie działania |
| NFR-2 | Desktop 16:9 (laptop + telewizor), czytelność z odległości (duże napisy), sterowanie myszą, klawiaturą i dotykiem |
| NFR-3 | Interfejs po polsku |
| NFR-4 | 60 fps animacji na przeciętnym laptopie, animacje tylko `transform` i `opacity` |
| NFR-5 | `prefers-reduced-motion` respektowane |
| NFR-6 | Dźwięk generowany w przeglądarce (bez plików audio), domyślnie cichy, z przyciskiem wyciszenia |
| NFR-7 | Testy: silnik dokładnie (Vitest), UI tylko ścieżka główna (Playwright) |

## 6. Architektura

```
 Przeglądarka (statyczna SPA: React 19 + TS + Tailwind 4, Vite 7)
 ├── engine/   czysta TS: reguły, walidacja, losowanie, cofnięcie (bez DOM)
 ├── state/    reducer + maszyna stanów wydarzenia
 ├── storage/  localStorage + WebCrypto (PBKDF2 -> AES-GCM)
 ├── scene/    SVG: polana, ognisko, zwierzęta, kapelusz, koperta
 ├── ui/       ekrany: odblokowanie, konfiguracja, wydarzenie, zasłoń, pomoc
 └── audio/    Web Audio: muzyka i efekty syntezowane
 Dostawa: GitHub Pages (https) lub dist/index.html (plik, offline)
```

## 7. Przebieg wydarzenia

| Faza | Co się dzieje | Przejście |
|---|---|---|
| `LOCKED` | Hasło (pierwsze uruchomienie: ustawienie hasła) | Poprawne hasło |
| `SETUP` | Konfiguracja za bramką | Operator zatwierdza (walidacja rozwiązywalności) |
| `BUDGET` | Przypomnienie o wspólnym ustaleniu kwoty; Operator wpisuje budżet na jeden prezent | Zatwierdzenie poprawnej kwoty |
| `DRAWING` | Losowanie zwierzątko po zwierzątku | Wszyscy wylosowali |
| `DONE` | Podsumowanie bez ujawniania wyników | Resety |

## 8. Decyzje

| Decyzja | Uzasadnienie |
|---|---|
| Stack jak w projekcie wyboru telefonu (React 19, TS, Tailwind 4, Vite 7, npm, Pages) | Spójność, znane narzędzia |
| Tailwind do układu, ręczny CSS do animacji, atmosfery i ziarna papieru | Tailwind nie nadaje się do bogatych animacji SVG |
| Szablon zwierząt z `child-train` (jeden szablon, gatunek = sylwetka + kolor futra + szalik) | Spójny wygląd i szybki start |
| Silnik jako czysta TypeScript | Łatwe testy bez przeglądarki |
| Dźwięk syntezowany (Web Audio) | Brak plików i licencji, działa w pliku offline |
| Jedno hasło do odszyfrowania i strefy admina | Prostota, mała grupa |

## 9. Poza zakresem v1

Backend, konta, wiele wydarzeń naraz, historia starsza niż rok, powiadomienia, listy życzeń, synchronizacja między urządzeniami.

## 10. Główne ryzyka

| Ryzyko | Postępowanie |
|---|---|
| Wspólny ekran zdradza wynik (ktoś patrzy) | Tryb "zasłoń" + przytrzymanie + auto-ukrycie i zakończenie sesji przy utracie fokusu. Faza 8: dwa okna |
| `localStorage` w pliku `file://` bywa niestabilny między przeglądarkami i ścieżkami | Główny tryb: Pages lub `localhost`. Plik offline jako awaryjny, z eksportem kopii zapasowej |
| Zgubione hasło = utrata danych | Jawne ostrzeżenie, eksport kopii; Reset całości dostępny także na ekranie blokady po potwierdzeniu, bez odzyskiwania danych |
| Zamknięcie lub odświeżenie w trakcie ujawnienia | Przy odtworzeniu stanu niezakończoną sesję uznajemy za zakończoną; wynik dostępny wyłącznie przez podgląd admina, jeśli był włączony |
| Autoodtwarzanie dźwięku blokowane przez przeglądarkę | Dźwięk startuje po pierwszym geście (wpisanie hasła) |
| Wyniki w pamięci podczas sesji widoczne w narzędziach deweloperskich | Świadome ograniczenie (zaufana grupa), opisane w `SECURITY-SPEC` |
| Za mało czasu (termin ASAP) | `ROADMAP.md`: linia cięcia MVP |

## 11. Konwencje

- Gałęzie `main` i `feature/phase-N-opis`, PR-y z CI, Conventional Commits.
- Brak sekretów w repo (publiczne). Dane rodziny nigdy w repo ani w testach (tylko dane fikcyjne).
- Definicja "gotowe" fazy: kryteria akceptacji z `docs/stages/PHASE-N.md` spełnione, CI zielone.

## 12. Otwarte kwestie (domyślne ustalenia)

| Kwestia | Domyślnie | Faza |
|---|---|---|
| Kolejność losowania | Dowolna, wskazuje Operator | 5 |
| Zakres wpisywanej kwoty | Domyślnie 10–2000 jednostek wybranej waluty, liczby całkowite; zakres konfigurowalny | 3 |
| Minimalna liczba uczestników | 7 w interfejsie; 2–6 osób wyłącznie w defensywnych testach silnika | 3 |
| Auto-ukrycie wyniku | 10 s | 5 |
| Wydarzenie "po fakcie": ponowny wgląd w wynik | Tylko podgląd admina (hasło) | 5 |
| Ponowne losowanie po cofnięciu | Ten sam odbiorca pozostaje możliwy, jeśli nadal jest poprawnym kandydatem | 1, 5 |
| Czcionki | Fraunces + DM Sans (jak w `child-train`), pismo odręczne tylko na tabliczkach z imionami | 4 |