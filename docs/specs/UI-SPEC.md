# UI-SPEC — ekrany, ceremonia, sterowanie, dźwięk

## 1. Zasady

- Jeden pełnoekranowy widok 16:9 (laptop + telewizor), bez routingu. Stan wynika z maszyny stanów.
- **Czytelność z kilku metrów:** duże napisy (min. ~28 px równoważnika na 1080p dla treści kluczowych), wysoki kontrast.
- Sterowanie dowolne: mysz, klawiatura, dotyk. Zawsze jeden wyraźny "główny przycisk" (jak klawisz Enter w `child-train`) z etykietą dopasowaną do stanu.
- Nic pilnego: brak odliczania, punktów, presji czasu.
- Ekran wydarzenia nie pokazuje reguł ani "kto dla kogo".

## 2. Ekrany i stany

| Stan | Ekran | Główny przycisk |
|---|---|---|
| `LOCKED` (pierwszy raz) | Ustawienie hasła, ostrzeżenie o utracie, powtórzenie hasła | "Zapisz hasło" |
| `LOCKED` | Wpisanie hasła | "Odblokuj" |
| `SETUP` | Scena w tle + panel konfiguracji (strefa admina, patrz `PHASE-3`) | "Zatwierdź i zacznij" |
| `BUDGET` | Przypomnienie, aby wspólnie ustalić kwotę na jeden prezent, oraz pole kwoty | "Zatwierdź budżet" |
| `DRAWING` | Scena, kapelusz z kopertami, zwierzęta z odznakami "wylosowano" | "Losuje: {zwierzątko}" po wskazaniu, w przeciwnym razie "Wskaż, kto losuje" |
| `DONE` | Spokojne podsumowanie: wszystkie zwierzęta z odznakami, dzwoneczek | "Zakończ" |
| Nakładka "zasłoń" | Ciemna nakładka, instrukcja, przytrzymanie | "Przytrzymaj, aby zobaczyć" |
| Nakładka pomocy `?` | Lista sterowania | "Zamknij" |

## 3. Scena (układ)

- Zimowa polana, wieczór. Ognisko pośrodku, wokół zwierzęta w dwóch rzędach (tylny wyżej i mniejszy, przedni niżej), do 12 sztuk.
- Kapelusz na pniaku z przodu pośrodku. Drewniana tablica z budżetem obok ogniska.
- Pod każdym zwierzątkiem drewniana tabliczka z imieniem (pismo odręczne).
- Odznaki nad zwierzątkiem: pusta albo "wylosowano" (zapieczętowana koperta).
- Szczegóły rysunku: `ART-SPEC.md`.

## 4. Ceremonia losowania (krok po kroku)

1. Operator wskazuje zwierzątko (klik, `Tab` + `Enter`, strzałki) lub używa przycisku "Następne w kręgu".
2. Zwierzątko podchodzi do kapelusza (ruch o ~1,5 s), kapelusz lekko się kołysze.
3. Zwierzątko wyciąga zapieczętowaną kopertę. **Publicznie widać tylko pieczęć** (bez imienia na kopercie).
4. Koperta unosi się nad głowę zwierzątka. Pojawia się nakładka "zasłoń" (§5).
5. Po zamknięciu nakładki koperta zmniejsza się do odznaki "wylosowano" nad zwierzątkiem.
6. Gdy wszyscy wylosowali, zimowe światełka na polanie rozbłyskują i gra dzwoneczek.

Losowanie jest odporne na podwójne kliknięcie: akcja jest zatrzaśnięta do końca ceremonii.

## 5. Tryb "zasłoń"

- Przed ujawnieniem: karta "Teraz losuje {imię}. Reszta odwraca wzrok", przycisk "Jestem gotowy/a".
- Ujawnienie: karta z zwierzątkiem i imieniem osoby, dla której kupuje się prezent, plus budżet i waluta, widoczna **tylko podczas przytrzymania**. Puszczenie ukrywa natychmiast, maks. 10 s.
- "Zamknij", utrata fokusu nakładki lub okna/karty oraz odświeżenie kończą sesję i ustawiają `revealCompleted`. Przejście fokusu wewnątrz nakładki jej nie kończy. Szczegóły i odtwarzanie przerwanej sesji: `SECURITY-SPEC.md` §6.

## 6. Wspólnie ustalony budżet

- Aplikacja przypomina: "Ustalcie wspólnie kwotę na jeden prezent, a następnie wpiszcie ją poniżej".
- Operator wpisuje jedną kwotę obowiązującą wszystkich. Pole przyjmuje liczby całkowite w skonfigurowanym zakresie, domyślnie 10–2000 wybranej waluty.
- Po zatwierdzeniu tablica pokazuje wpisaną kwotę bez przeliczania i zaokrąglania, np. "Na prezent: 100 zł". Bez poprawnej kwoty nie można rozpocząć losowania.
- Aplikacja nie prowadzi głosowania nad budżetem ani nie zapisuje indywidualnych głosów.

## 6a. Strefa admina

Osobny panel nad sceną (po haśle): konfiguracja, podgląd, cofnięcie ostatniego losowania, kopie, resety. Cofnięcie wymaga potwierdzenia, nie ujawnia odbiorcy i pozwala osobie losować ponownie. Po cofnięciu z `DONE` wydarzenie wraca do `DRAWING`. Opis w `PHASE-3.md`. W trybie wydarzenia panel jest zamknięty.

## 7. Sterowanie i pomoc `?`

Przycisk `?` w rogu, dostępny zawsze. Zawartość pomocy:

| Akcja | Mysz/dotyk | Klawiatura |
|---|---|---|
| Wybór zwierzątka | Klik/dotknięcie | `←`/`→` lub `Tab`, potem `Enter` |
| Główny przycisk | Klik/dotknięcie | `Enter` lub `Spacja` |
| Przytrzymaj, aby zobaczyć | Przytrzymanie przycisku | Przytrzymanie `Spacji` |
| Wyciszenie dźwięku | Ikona głośnika | `M` |
| Pomoc | `?` | `?` lub `F1` |
| Strefa admina | Zębatka (wymaga hasła) | `Ctrl+Shift+A` (wymaga hasła) |

Pomoc zawiera też krótką instrukcję wydarzenia (kolejność kroków) i uwagę o prywatności ("zasłoń" i odwróć wzrok).

## 8. Dostępność i dopasowanie

- Jedna strefa `aria-live="polite"` z komunikatami o stanie (bez ujawniania wyników).
- Fokus widoczny, nakładki zatrzymują fokus i oddają go po zamknięciu.
- `prefers-reduced-motion`: wyłączone ruchy ciągłe, zostają przejścia kolorów i zmiany stanu.
- Skalowanie do rozdzielczości 1280×720 do 3840×2160, układ w ramce 16:9 z `safe` marginesami.

## 9. Dźwięk

| Element | Opis |
|---|---|
| Muzyka | Generowana w Web Audio: spokojna, pętlowa melodia w stylu pozytywki, pogłos, delikatne dzwoneczki (oryginalna kompozycja, bez cudzych nagrań). Głośność domyślnie niska |
| Efekty | Trzask ogniska (przefiltrowany szum), szelest koperty, ciche "plum" pieczęci, dzwoneczek na zakończenie |
| Start | Po pierwszym geście użytkownika (wpisanie hasła), zgodnie z zasadami autoodtwarzania |
| Kontrola | Ikona głośnika i klawisz `M`, stan wyciszenia zapisany (niewrażliwe ustawienie) |
| Wyciszenie w "zasłoń" | Efekty dźwiękowe nie zdradzają wyniku (te same dźwięki dla każdego losowania) |
| Wydajność | Bez plików audio, brak wpływu na rozmiar paczki |

## 10. Teksty (polski, przykłady)

| Miejsce | Tekst |
|---|---|
| Pierwsze uruchomienie | "Ustaw hasło. Bez niego nie odzyskasz danych." |
| Pytanie przed ujawnieniem | "Teraz losuje {imię}. Reszta odwraca wzrok." |
| Przycisk ujawnienia | "Przytrzymaj, aby zobaczyć" |
| Po losowaniu | "Gotowe! Wynik zostaje tajemnicą." |
| Zakończenie | "Wszyscy wylosowali. Wesołych Świąt!" |