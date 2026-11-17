# ART-SPEC — styl, zwierzęta, scena

Wzór: repo `child-train` (płaski "papierowy" storybook, samo inline SVG, bez rastrów). Poniżej to, co przenosimy, i to, co dostosowujemy do zimowej polany.

## 1. Zasady renderowania (przeniesione)

| Zasada | Opis |
|---|---|
| Wypełnienia, nie kontury | Kształty z pełnych wypełnień. Obrys tylko tam, gdzie obrys jest obiektem (gałązka, wąsy, linia kapelusza) |
| Miękkie linie | Każda kreska z `strokeLinecap="round"`, grubości ok. 2–5 px (w siatce 1920×1080), do 8–9 px dla pni i belek |
| Bez efektów cyfrowych | Zero filtrów, rozmyć, cieni. Głębia przez nakładanie jaśniejszych/ciemniejszych pasm |
| Zaokrąglone rogi | Prostokąty z `rx`, wzgórza i chmury z krzywych, bez wielokątów |
| Ziarno papieru | Nakładka SVG noise ~12% na całości (jak `.little-world::after`) |
| Bez czerni i czystej bieli | Biel tylko w iskierkach (odblask w oku, śnieg w świetle ognia) |
| Bez perspektywy | Dwa rzędy zwierząt zamiast perspektywicznego koła |

Czego unikać: gradientów na postaciach, połysku, grubych obrysów, nasyconych kolorów podstawowych, ostrych narożników, wyglądu naklejki lub sprite'a z gry.

## 2. Paleta zimowego wieczoru

| Rodzina | Przykładowe wartości | Użycie |
|---|---|---|
| Kremy papieru | `#fffcf3` `#f5eedb` `#f8f5e8` | Śnieg, chmury, jasne futro, koperty |
| Chłodne błękity i fiolety | `#b7c4ce` `#a6b4c8` `#8d9bb8` `#6f7fa3` | Niebo wieczorne, cienie na śniegu, odległe wzgórza |
| Ciemne zielenie | `#3f4d40` `#3e5b4d` `#557c66` | Sosny, szaliki, oczy, tekst |
| Ziemia i drewno | `#b96f52` `#9c7155` `#777c58` | Pniaki, tablica, domki |
| Ognisko | `#e3a35a` `#d98a4a` `#f2c978` | Płomień, ciepły blask (półprzezroczysta elipsa) |
| Pieczęć | `#b45a4a` `#c98a7a` | Woskowa pieczęć na kopercie |
| Różu | `#cf9f89` (55%) `#dcb9a8` | Policzki, uszy |

Zmiany atmosfery sterowane zmiennymi CSS (jak `--sky-top`, `--sky-bottom`, `--ink`, `--muted`, `--accent`, `--ground`). Atmosfera w tym projekcie jest **stała** (zimowy wieczór), bez cyklu dnia, z powolnym dryfem intensywności śniegu i migotaniem ogniska (tylko `opacity`/`transform`).

## 3. Zwierzęta

- Jeden szablon (okrągła głowa `r≈26–34`, mniejszy tułów, owalne łapki, jedna łapka machająca, szalik) z `child-train`. Gatunek = **sylwetka** + **kolor futra** + jedna barwa szalika.
- Wspólna twarz (dwa ciemne owale, mały nos, uśmiech, różowe policzki). Własna twarz tylko dla sowy, kaczki, owcy, żółwia.
- Nastroje: `cheerful` (domyślny), `curious`, `dozing`. W tym projekcie dodatkowo: `holding-envelope` (łapki unoszą kopertę).
- Szaliki w czterech stonowanych barwach, rozdzielane tak, by sąsiedzi się różnili.

### Gatunki

| Źródło | Gatunki |
|---|---|
| Z `child-train` (16) | Króliczek, Lisek, Miś, Jeżyk, Sówka, Wiewiórka, Kotek, Piesek, Żabka, Borsuk, Jelonek, Myszka, Kaczuszka, Owieczka, Prosiaczek, Żółwik |
| Do dorysowania w razie potrzeby | Gil (czerwona pierś), Wilczek, Lisek polarny, Pingwin |

Ponieważ uczestników jest 7–12, a gatunków 16, **nowe zwierzęta nie są wymagane**. Dodajemy je tylko, gdy ktoś chce konkretne zwierzę, którego brakuje.

Dodawanie gatunku: zacząć od szablonu, zmienić kolor futra i warstwę sylwetki, zachować twarz (chyba że gatunek wymaga własnej) i szalik, zarejestrować w `AnimalKind`, `ALL_ANIMALS` i `FUR_COLORS` (TypeScript pilnuje spójności).

## 4. Scena i rekwizyty

| Element | Opis |
|---|---|
| Niebo | Wieczorny gradient (4 miękkie przejścia dozwolone: ziemia, mgła, wieczór, halo księżyca), księżyc ze zmienną fazą, migoczące gwiazdy |
| Wzgórza | 3–4 nakładające się pasma, im dalej tym jaśniejsze i bardziej błękitne, z kremową czapą śniegu |
| Sosny | Ośnieżone sosny po bokach i w tle, kilka zbliżonych zieleni |
| Ognisko | Płomień z 3 warstw (rx zaokrąglone), kamienie, drewniane polana. Blask jako półprzezroczysta elipsa. Migotanie opacity |
| Pniaki i kłody | Siedziska dla zwierząt, kapelusz leży na centralnym pniaku z przodu |
| Kapelusz | Wysoki, miękki, zielony z kremowym paskiem (wizualna rodzina z czapką konduktora) |
| Koperta | Krem, woskowa pieczęć (bez żadnych napisów publicznie). Kształt rozpoznawalny nawet z odległości |
| Tablica budżetu | Drewniana, na dwóch palikach, odręczne litery, wspólnie ustalona kwota na prezent po zatwierdzeniu |
| Tabliczki z imionami | Małe drewniane, odręczne pismo (czcionka OFL sprawdzona pod kątem znaków ąćęłńóśźż) |
| Odznaki | Pusta / zapieczętowana koperta "wylosowano" |
| Śnieg | Kilkadziesiąt płatków w 2–3 głębiach, powolne opadanie (animacja transform), warstwa zatrzymywana przy `prefers-reduced-motion` |
| Światełka | Girlanda w tle zapalana na zakończenie (opacity) |

## 5. Siatka i układ

- Siatka SVG 1920×1080, skalowana do okna z zachowaniem 16:9.
- Od 7 do 12 zwierząt: rząd tylny (do 6) y≈560–620 skala 0,85, rząd przedni (do 6) y≈720–800 skala 1,0. Ognisko pośrodku y≈650, kapelusz na pniaku y≈860 pośrodku.
- Przy mniejszej liczbie uczestników zwierzęta rozkładane równomiernie względem ogniska. Algorytm układu to czysta funkcja `layout(n)` (testowalna).

## 6. Czcionki

| Rola | Wybór |
|---|---|
| Nagłówki i tytuł | Fraunces (jak w `child-train`) |
| Tekst interfejsu | DM Sans |
| Tabliczki z imionami | Odręczna czcionka OFL (np. Caveat lub Patrick Hand), po weryfikacji pełnego zestawu polskich znaków. Osadzona jako WOFF2 (podzbiór `latin` + `latin-ext`) |

## 7. Budżet zasobów

| Zasób | Limit |
|---|---|
| Całość `dist/index.html` | cel ≤ 1,5 MB (czcionki zajmują większość) |
| Liczba elementów SVG w scenie | utrzymać rozsądnie, memoizować scenę (jak w `child-train`) |
| Animacje | Tylko `transform` i `opacity`, brak animacji `filter` |

## 8. Lista kontrolna przy dodawaniu elementu graficznego

1. Wypełnienia i miękkie linie, bez filtrów.
2. Kolory ze zmiennych lub z palety, brak czerni.
3. Test przy `prefers-reduced-motion` i na 1280×720.
4. Nie wygląda jak naklejka ani sprite.