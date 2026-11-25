# PHASE-6 — Dźwięk i dopieszczenie

**Rozmiar:** S/M. **Zależy od:** 5. **Specyfikacja:** `UI-SPEC` §9.
**Cel:** spokojny, świąteczny dźwięk generowany w przeglądarce oraz dopieszczenie ruchu i atmosfery.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Muzyka syntezowana (Web Audio) | Pliki audio, cudze nagrania |
| Efekty: ognisko, koperta, pieczęć, dzwoneczek | Funkcje dodatkowe z fazy 8 |
| Wyciszenie i klawisz `M` | |
| Dopieszczenie animacji (kapelusz, koperta, światełka) | |

## 2. Zadania

### 2.1 Dźwięk
- [x] Moduł `audio` z jednym `AudioContext`, uruchamianym po pierwszym geście (wpisanie hasła)
- [x] Muzyka: oryginalna, spokojna pętla w stylu pozytywki (generatywna: skala pentatoniczna, wolne tempo, pogłos), niska głośność
- [x] Efekty: trzask ogniska (przefiltrowany szum), szelest koperty, "plum" pieczęci, dzwoneczek na zakończenie
- [x] Efekty identyczne dla każdego losowania (nie zdradzają wyniku)
- [x] Wyciszenie: ikona i klawisz `M`, stan zapisany (niewrażliwy)
- [x] Obsługa wstrzymania karty (wyciszenie przy ukryciu karty)

### 2.2 Dopieszczenie
- [x] Płynność ceremonii (czasy, zatrzymania, ease), brak migotania
- [x] Zakończenie: światełka, delikatny rozbłysk śniegu
- [x] Przegląd wszystkich animacji pod kątem `prefers-reduced-motion`

## 3. Testy

| Rodzaj | Zakres |
|---|---|
| Jednostkowe | Moduł audio z atrapą `AudioContext` (start tylko po geście, wyciszenie) |
| Ręczne | Głośność, brak trzasków, wyciszenie w nakładce "zasłoń" nie zmienia dźwięków efektów |
| E2E | Przycisk wyciszenia działa i zapamiętuje stan |

## 4. Kryteria akceptacji
- [x] Dźwięk startuje dopiero po geście i można go wyciszyć w każdym momencie
- [x] Brak plików audio w paczce
- [x] Efekty nie ujawniają żadnych informacji o wyniku

## 5. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Muzyka męcząca przy dłuższym wydarzeniu | Niska głośność, spokojne tempo, łatwe wyciszenie, możliwość wyłączenia samej muzyki przy zachowaniu efektów |
| Różnice w obsłudze Web Audio między przeglądarkami | Test w Chrome, Firefox, Safari (jeśli dotyczy) |