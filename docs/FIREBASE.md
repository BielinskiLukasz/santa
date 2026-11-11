# Konfiguracja Firebase (plan Spark, bez karty)

Firebase Spark wystarczy w całości: **Firestore + Anonymous Auth**, bez Cloud Functions
i bez włączania rozliczeń. Klucze webowe Firebase nie są sekretami — trafiają do zmiennych
`NEXT_PUBLIC_*` i są wbudowane w statyczny bundle.

## 1. Projekt

1. Wejdź na <https://console.firebase.google.com/> → **Dodaj projekt**.
2. Wybierz plan **Spark (bezpłatny)** — nie podawaj karty płatniczej.
3. W projekcie dodaj aplikację webową (`</>`), nie włączaj hostingu Firebase
   (używamy GitHub Pages).

## 2. Usługi

1. **Authentication → Metody logowania** → włącz **Anonimowe**.
2. **Firestore Database → Utwórz bazę** → tryb produkcyjny, region najbliżej grupy.
   Darmowe limity Spark (50 tys. odczytów / 20 tys. zapisów dziennie) wystarczają
   z dużym zapasem dla kilku losowań po 10 osób.
3. **Firestore → Reguły** → wklej zawartość [`firestore.rules`](../firestore.rules)
   i opublikuj. Reguły blokują `list`, wymagają uwierzytelnienia, pilnują dzierżawy
   blokady, epoki i jednorazowości wyniku.

## 3. Zmienne środowiskowe

Wystarczy **jedna zmienna** — skopiuj obiekt konfiguracji aplikacji webowej
(`firebaseConfig`) z konsoli Firebase i wklej go jako JSON. Lokalnie do `.env`,
a w CI jako jeden secret `Settings → Secrets and variables → Actions`:

```
NEXT_PUBLIC_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"twoj-projekt.firebaseapp.com","projectId":"twoj-projekt","appId":"1:...:web:...","messagingSenderId":"..."}'
```

Dla kompatybilności obsługiwane są też pojedyncze zmienne
`NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID`,
`_MESSAGING_SENDER_ID`, ale nie są potrzebne.

Gdy w konfiguracji są `apiKey`, `projectId` i `appId`, `src/firebase/index.ts` wybiera
adapter Firestore. Bez nich aplikacja działa w trybie demonstracyjnym z lokalnym backendem
(`/api/draws`, PostgreSQL) — bez konta Firebase i bez żadnych zmiennych poza
`DATABASE_URL`, którą platforma ustawia automatycznie.

## 4. GitHub Pages

Workflow `.github/workflows/ci.yml`:

1. `npx vitest run` + `npx tsc --noEmit`.
2. Usunięcie `src/app/api` (Pages nie serwuje route handlerów Next.js).
3. `EXPORT_STATIC=1 npm run build` with `NEXT_PUBLIC_BASE_PATH=/<repo>`.
4. Publikacja katalogu `out/` (`actions/deploy-pages`).

W repozytorium włącz **Settings → Pages → Source: GitHub Actions**. `public/.nojekyll`
trafia do `out/`, więc pliki z podkreśleniami nie są pomijane.

## 5. Emulator Suite (testy lokalne)

```bash
npm install -g firebase-tools
firebase login
firebase emulators:start          # Firestore :8080, Auth :9099, UI :4000
```

Aplikacja połączy się z emulatorami po ustawieniu `NEXT_PUBLIC_FIREBASE_EMULATOR=1`
(oraz dowolnych, fikcyjnych wartości konfiguracyjnych Firebase). W emulatorze reguły
ładowane są z `firebase.json`.

### Scenariusze do sprawdzenia

| Scenariusz | Oczekiwany wynik |
|---|---|
| `get` na cudzym `/participants/{token}` | odrzucone (`uid != request.auth.uid`) |
| `list` na kolekcji uczestników | odrzucone |
| Dwie osoby przejmują blokadę jednocześnie | wygrywa jedna (transakcja + `epoch + 1`) |
| Przejęcie po 20 s od `acquiredAt` | dozwolone (`request.time` liczy serwer) |
| Commit ze starą `epoch` | odrzucony (ABA), klient odrzuca lokalny wynik |
| Drugi zapis `encryptedResult` | odrzucony (`resource.data.encryptedResult == null`) |
| Wynik bez zwolnienia blokady w tej samej transakcji | odrzucony (`getAfter(lock).holder == null`) |

## 6. Model danych

```
draws/{drawId}
  status, adminSeesAll, mode, seed, constraints[], roster[],
  takenReceivers[], drawnGivers[], steps[],
  resultBoxes{pid → szyfrogramy}, adminResults{pid → szyfrogram},
  epoch, adminUid, adminToken
  ├─ participants/{token}      # token = ID dokumentu, 128 bitów losowości
  │    name, uid, publicKey, claimed, encryptedResult, animation
  └─ state/lock
       holder, acquiredAt: serverTimestamp(), epoch
```

`resultBoxes` (zaszyfrowane skrzynki w dokumencie losowania) pozwalają zapisać wyniki
„dolosowanej reszty" bez ujawniania cudzych tokenów capability pozostałym uczestnikom.
