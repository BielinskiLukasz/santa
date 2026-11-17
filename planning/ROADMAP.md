# ROADMAP — Zwierzęta losują

Indeks planu. Opis projektu: `PROJECT.md`. Szczegóły faz: `docs/stages/`. Specyfikacje: `docs/specs/`.

Ścieżki `docs/` odnoszą się do katalogu głównego repozytorium.

## 1. Fazy

| Faza | Nazwa | Rozmiar | Zależy od | Plik |
|---|---|---|---|---|
| 0 | Fundament | S | — | `docs/stages/PHASE-0.md` |
| 1 | Silnik losowania | M | 0 | `docs/stages/PHASE-1.md` |
| 2 | Stan, zapis i szyfrowanie | M | 1 | `docs/stages/PHASE-2.md` |
| 3 | Konfiguracja (strefa admina) | M | 2 | `docs/stages/PHASE-3.md` |
| 4 | Scena i zwierzęta | L | 0 | `docs/stages/PHASE-4.md` |
| 5 | Przebieg wydarzenia | L | 2, 3, 4 | `docs/stages/PHASE-5.md` |
| 6 | Dźwięk i dopieszczenie | S/M | 5 | `docs/stages/PHASE-6.md` |
| 7 | Wydanie: offline, Pages, testy, QA | M | 5 (6 opcjonalnie) | `docs/stages/PHASE-7.md` |
| 8 | Dodatki (opcjonalne): QR i tryb dwóch okien | M | 5 | `docs/stages/PHASE-8.md` |

Rozmiary: S ≈ pół dnia, M ≈ 1–2 dni, L ≈ 2–4 dni pracy.

## 2. Kolejność przy terminie ASAP

```
0 ─┬─ 1 ── 2 ── 3 ─┐
   │               ├── 5 ── 6 ── 7 ── (8)
   └─ 4 ───────────┘
```

- Fazy **1–3** (logika) i **4** (grafika) są niezależne po fazie 0, więc można je prowadzić równolegle lub naprzemiennie.
- Faza 5 spina wszystko i jest najbardziej ryzykowna.

## 3. Linia cięcia MVP

| MVP (wystarczy na wydarzenie) | Można odłożyć |
|---|---|
| Fazy 0–5, minimalny dźwięk z fazy 6, faza 7 (Pages + offline + test ścieżki głównej) | Pełne dopieszczenie animacji i muzyki (6), QR i tryb dwóch okien (8), dodatkowe gatunki zwierząt |

Jeśli czas się kurczy, tniemy w tej kolejności: faza 8 → dopieszczenie fazy 6 → dodatkowe gatunki → drugi poziom animacji koperty.

Budżet na jeden prezent ustala się wspólnie poza aplikacją i wpisuje ręcznie. Głosowanie w aplikacji nie należy do zakresu.

## 4. Specyfikacje

| Plik | Zakres |
|---|---|
| `docs/specs/ENGINE-SPEC.md` | Reguły, algorytm, budżet, kontrakt silnika, testy |
| `docs/specs/SECURITY-SPEC.md` | Model zagrożeń, zapis, szyfrowanie, bramka, tryb "zasłoń", kopie, QR |
| `docs/specs/UI-SPEC.md` | Ekrany, przebieg ceremonii, sterowanie, pomoc `?`, dostępność, dźwięk |
| `docs/specs/ART-SPEC.md` | Styl, paleta, zwierzęta, scena, rekwizyty, atmosfera |

## 5. Definicja ukończenia całości

- [ ] Pełny przebieg (konfiguracja → budżet → losowanie wszystkich → podsumowanie) działa na Pages i z pliku offline
- [ ] Na ekranie wydarzenia nie ma żadnych reguł ani par "kto dla kogo"
- [ ] Stan przeżywa odświeżenie, dane w `localStorage` są zaszyfrowane
- [ ] Silnik przechodzi testy (w tym symulacje), ścieżka główna UI przechodzi Playwright
- [ ] Instrukcja `?` opisuje sterowanie
- [ ] README opisuje uruchomienie i wydarzenie krok po kroku