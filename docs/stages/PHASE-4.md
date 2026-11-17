# PHASE-4 — Scena i zwierzęta

**Rozmiar:** L. **Zależy od:** 0 (można równolegle z fazami 1–3). **Specyfikacja:** `docs/specs/ART-SPEC.md`.
**Cel:** gotowa zimowa polana z kręgiem zwierząt, ogniskiem, kapeluszem i kopertą, w spójnym ręcznie rysowanym stylu.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Szablon zwierząt przeniesiony z `child-train` | Logika losowania i stanów |
| Scena: niebo, wzgórza, sosny, ognisko, pniaki | Dźwięk |
| Kapelusz, koperta, tablica budżetu, tabliczki, odznaki | Ceremonia jako przepływ (faza 5) |
| Atmosfera: śnieg, wieczór, światełka | |
| Układ `layout(n)` do 12 zwierząt | |

## 2. Zadania

### 2.1 Zwierzęta
- [ ] Przenieść szablon z `child-train` (komponent `Animal`, `FUR_COLORS`, `scarfFor`, `CUSTOM_FACE`, `AnimalKind`, `ALL_ANIMALS`)
- [ ] Zweryfikować i dostosować palety do zimowego wieczoru (przygaszone, ciepłe)
- [ ] Nastrój `holding-envelope` (łapki unoszą kopertę)
- [ ] Rozdział szalików tak, by sąsiedzi się różnili
- [ ] (Opcjonalnie) dodatkowe gatunki: Gil, Wilczek, Lisek polarny, Pingwin

### 2.2 Scena
- [ ] Niebo wieczorne z księżycem i gwiazdami (zmienne CSS)
- [ ] 3–4 pasma wzgórz z czapami śniegu, ośnieżone sosny
- [ ] Ognisko: 3-warstwowy płomień, kamienie, polana, półprzezroczysty blask, migotanie `opacity`
- [ ] Pniaki/kłody jako siedziska, centralny pniak na kapelusz
- [ ] Śnieg: 2–3 głębie, animacja `transform`
- [ ] Girlanda świateł (wyłączona do zakończenia)

### 2.3 Rekwizyty
- [ ] Kapelusz (zielony, kremowy pasek)
- [ ] Koperta z woskową pieczęcią (bez napisów)
- [ ] Tablica budżetu (drewniana, odręczne litery)
- [ ] Tabliczki z imionami (odręczna czcionka OFL, test polskich znaków)
- [ ] Odznaki: pusta / wylosowano

### 2.4 Układ i skalowanie
- [ ] `layout(n)`: czysta funkcja zwracająca pozycje i skale (2 rzędy, 7–12)
- [ ] Siatka 1920×1080, skalowanie do 16:9, test 1280×720 i 3840×2160
- [ ] Memoizacja sceny (jak w `child-train`)

### 2.5 Dostępność i ruch
- [ ] `prefers-reduced-motion`: zatrzymanie śniegu i migotania, zostają przejścia kolorów
- [ ] Tylko `transform` i `opacity` w animacjach
- [ ] Opisy tekstowe sceny dla czytników ekranu (bez wyników)

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Jednostkowe | `layout(n)` dla n = 7…12 (brak nakładania, symetria) |
| Wizualne (ręczne) | Przegląd przy 1280×720, 1920×1080, 3840×2160 |
| Komponentowe | Rejestr zwierząt (TypeScript wymusza spójność), render dla 12 postaci |
| Wydajność | Płynność animacji na przeciętnym laptopie |

## 4. Kryteria akceptacji
- [ ] Scena pasuje stylem do `child-train`, bez filtrów i cieni
- [ ] 12 zwierząt jest rozróżnialnych z kilku metrów
- [ ] Polskie znaki w tabliczkach renderują się poprawnie
- [ ] `layout(n)` działa dla 7–12 osób

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Pochłonie najwięcej czasu | Linia cięcia MVP: pierwszą wersję robić z istniejącymi 16 zwierzętami, dodatkowe gatunki później |
| Zbyt ciężka scena na telewizorze | Memoizacja, ograniczenie elementów, test przy 4K |
| Rozjazd stylu | Lista kontrolna z `ART-SPEC` §8 przy każdym nowym elemencie |