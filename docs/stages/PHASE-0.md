# PHASE-0 — Fundament

**Rozmiar:** S. **Zależy od:** —.
**Cel:** repozytorium z działającym szkieletem, CI i wdrożeniem na Pages. Zero logiki biznesowej.

## 1. Zakres

| W zakresie | Poza zakresem |
|---|---|
| Struktura repo, README, MIT | Silnik, stan, grafika |
| Vite + React + TS + Tailwind | Ekrany aplikacji |
| Testy (Vitest, Playwright) – szkielet | Pełne testy ścieżki głównej (faza 7) |
| CI i deploy na Pages | Build offline (faza 7) |

## 2. Zadania

### 2.1 Repo
- [ ] Repo publiczne: obecnie `santa`, rekomendowana nazwa `zwierzeta-losuja` do decyzji właściciela; licencja MIT, `.gitignore`, `.editorconfig`
- [ ] Dokumentacja z planu: `planning/PROJECT.md`, `planning/ROADMAP.md`, `docs/specs/*`, `docs/stages/*`
- [ ] README: opis, uruchomienie (`npm install`, `npm run dev`), linki do dokumentacji
- [ ] Ochrona gałęzi `main` (wymagane CI)

### 2.2 Stack
- [ ] Wersje przypięte jak w projekcie wyboru telefonu: React 19.2.6, TypeScript 5.9.3, Tailwind CSS 4.1.17, Vite 7.3.7 (zweryfikować aktualność i zgodność w dniu startu), npm
- [ ] TypeScript `strict`, `noUncheckedIndexedAccess`
- [ ] Tailwind 4 przez wtyczkę Vite, motyw z paletą z `ART-SPEC`
- [ ] ESLint + Prettier, skrypty: `dev`, `build`, `typecheck`, `lint`, `test`, `test:e2e`
- [ ] Katalogi: `src/engine`, `src/state`, `src/storage`, `src/scene`, `src/ui`, `src/audio`, `src/i18n`, `tests/`
- [ ] `src/i18n/pl.ts` ze stałymi tekstami

### 2.3 Testy
- [ ] Vitest (środowisko Node dla silnika, jsdom dla komponentów)
- [ ] Playwright (Chromium) z jednym testem "strona się ładuje"

### 2.4 CI i hosting
- [ ] Workflow `ci.yml`: typecheck, lint, test, build, cache npm
- [ ] Workflow `deploy.yml`: build i publikacja na GitHub Pages, `base` zgodny z nazwą repo
- [ ] Badge statusu w README

## 3. Kryteria akceptacji
- [ ] `npm run dev` pokazuje stronę-placeholder
- [ ] CI zielone, deploy publikuje stronę na Pages
- [ ] README pozwala obcej osobie uruchomić projekt w kilka minut

## 4. Ryzyka
| Ryzyko | Postępowanie |
|---|---|
| Niezgodność przypiętych wersji | Sprawdzić `npm install` i build na starcie, w razie potrzeby podbić wersje i odnotować w README |
| Zły `base` na Pages | Test po pierwszym deployu |