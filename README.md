# Zwierzęta losują

[![CI](https://github.com/BielinskiLukasz/santa/actions/workflows/ci.yml/badge.svg)](https://github.com/BielinskiLukasz/santa/actions/workflows/ci.yml)

Statyczna aplikacja planowana do rodzinnego losowania prezentów. Obecnie dostępna jest strona startowa fazy 0. Losowanie, konfiguracja uczestników i przechowywanie danych nie są jeszcze zaimplementowane.

## Uruchomienie

Wymagany jest Node.js 20.19+, 22.13+ albo 24+; zalecany jest aktualny Node 22 LTS.

```bash
npm install
npm run dev
```

Adres serwera pojawi się w terminalu. Pierwsze `npm install` utworzy `package-lock.json`; plik należy dodać do repozytorium, aby kolejne instalacje mogły używać `npm ci`.

## Kontrole

```bash
npm run typecheck
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Źródło strony, style i kod interakcji znajdują się w `index.html`. Vite buduje stronę do `dist/index.html`. TypeScript sprawdza konfigurację, testy i przygotowane teksty w `src/i18n/pl.ts`; kod JavaScript osadzony w HTML sprawdza ESLint. Teksty strony startowej są obecnie wpisane bezpośrednio w HTML.

Strona startowa korzysta z Tailwind Browser CDN oraz zewnętrznych czcionek. Nie jest to jeszcze wydanie bez dostępu do sieci, które zaplanowano w fazie 7.

## GitHub Pages

1. Wypchnij zmiany do repozytorium i uruchom workflow `CI`.
2. W ustawieniach repozytorium wybierz **Settings → Pages → Build and deployment → GitHub Actions**.
3. Po udanym `CI` wywołanym przez push do `main` workflow `Deploy Pages` opublikuje sprawdzony commit. Workflow można również uruchomić ręcznie na `main`.
4. W **Settings → Branches** skonfiguruj ochronę `main` i wymagaj zakończenia kontroli `CI / checks` przed scaleniem.

Vite używa względnej ścieżki bazowej `./`, dzięki czemu build można udostępnić w katalogu repozytorium na Pages. Ustawienia repozytorium, ochrony gałęzi i publikacja wymagają uprawnień właściciela.

## Dokumentacja

- [Opis projektu](planning/PROJECT.md)
- [Harmonogram](planning/ROADMAP.md)
- [Specyfikacje](docs/specs/)
- [Plany faz](docs/stages/)