# Model bezpieczeństwa i jego granice

## Co jest chronione

| Warstwa | Mechanizm |
|---|---|
| Wynik w bazie | RSA-OAEP 2048 / WebCrypto; baza przechowuje wyłącznie szyfrogramy |
| Klucz prywatny | nigdy nie opuszcza przeglądarki (`localStorage`), opcjonalnie w linku ratunkowym |
| Tożsamość | 128-bitowy token w hashu URL (capability URL) + Anonymous Auth `uid` |
| Kopie dla admina | tworzone **tylko** gdy `adminSeesAll = true`, szyfrowane kluczem publicznym admina |
| Wyścigi | transakcyjne przejęcie blokady, `epoch` (ABA), atomowy commit, 20 s lease |
| Ponowne losowanie | reguły i serwer wymagają `encryptedResult == null` |
| Unikalność odbiorcy | reguły (`takenReceivers.toSet().size()`), serwer oraz silnik |
| Widoczność wyniku | UI odszyfrowuje wyłącznie szyfrogram z bazy, dopiero po potwierdzeniu zapisu |

## Blokada losowania (lease lock)

| Pole | Znaczenie |
|---|---|
| `holder` | `uid`/token osoby trzymającej blokadę albo `null` |
| `acquiredAt` | `serverTimestamp()` / `now()` — czas liczy **serwer**, nie klient |
| `epoch` | zwiększany przy każdym przejęciu i zwolnieniu (ochrona przed ABA) |

Reguły Firestore sprawdzają wygaśnięcie: `acquiredAt + 20 s < request.time`.
Klient stosuje margines 15 s: po jego przekroczeniu nie wykonuje commitu, odrzuca lokalny
wynik i prosi o ponowną próbę. Zamknięcie karty w trakcie nie blokuje grupy — blokada
wygasa sama po 20 s. Animacja odbywa się **po** zwolnieniu blokady.

## Obsługa awarii

| Sytuacja | Zachowanie |
|---|---|
| Ktoś inny trzyma blokadę | ekran oczekiwania, automatyczna ponowna próba (`onSnapshot` / polling) |
| Zamknięta karta | wygaśnięcie po 20 s |
| Blokada wygasła przed commitem | reguły/serwer odrzucają zapis, klient wyrzuca lokalny wynik |
| Commit się udał, odpowiedź zginęła | ponowna próba wykrywa własny szyfrogram (idempotencja) i go odszyfrowuje |
| Drugie losowanie tej samej osoby | odrzucone przez reguły i serwer |
| Brak opcji dla osoby | silnik nie dopuszcza takiego stanu; w razie błędu komunikat dla admina |

## Granice (świadomie zaakceptowane)

1. **Zgodność wyboru z zakazami waliduje klient.** Plan Spark nie ma Cloud Functions,
   więc reguły nie uruchomią silnika. Zmodyfikowany klient mógłby zapisać parę naruszającą
   zakazy. Reguły pilnują jednak blokady, epoki, braku ponownego losowania i unikalności
   odbiorcy. W adapterze demonstracyjnym serwer dodatkowo powtarza pełną walidację silnika.
   Dla zabawy rodzinnej to akceptowalne.
2. **Link = uprawnienie.** Ktokolwiek pozna link uczestnika, odczyta jego wynik (ma token,
   a po dołączeniu także powiązany `uid`). Nie wysyłaj linków na wspólny czat.
3. **Link ratunkowy zawiera klucz prywatny w hashu.** Hash nie trafia do logów serwera,
   ale może trafić do historii przeglądarki / schowka. Traktuj go jak sam wynik.
4. **Utrata klucza prywatnego i obu linków** oznacza, że odczyt wyniku jest niemożliwy
   (nie istnieje escrow ani reset hasła).
5. **Admin z `adminSeesAll = true` widzi wszystko** — opcja musi być wybrana świadomie
   przy tworzeniu, nie można jej zmienić później.
6. **Anonimowe `uid` jest powiązane z przeglądarką.** Po wyczyszczeniu danych na nowym
   urządzeniu użyj linku ratunkowego (zawiera klucz) — reguły dopuszczają ponowne
   powiązanie dokumentu w lobby.
7. **Darmowy plan Spark może zmienić limity.** Warstwa `src/firebase` jest odseparowana
   od silnika i UI; migracja do innego backendu wymaga tylko nowej implementacji
   `DrawRepository`.
