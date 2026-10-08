# ROADMAP — moduł franczyzowy Betreuung 24

Stan na **08.10.2026** · gałąź `feature/franchise-calculator`

**Etapy 1–5 zamknięte. Zostały dwie pozycje odłożone świadomą decyzją PO
i zestaw sprawdzeń, które wymagają kliknięcia w uruchomionej aplikacji.**

| Etap | Zakres | Stan |
| --- | --- | --- |
| 1 | Fundament — repozytorium i środowiska | ✅ 5/5 |
| 2 | Baza danych i uprawnienia | ✅ 5/5 |
| 3 | Backend modułu franczyzowego | ✅ 4/4 |
| 4 | Interfejs — zakładka Franchise | ✅ 6/6 |
| 5 | Domknięcie | ✅ 5/7 — 2 odłożone decyzją PO |

---

## Co moduł robi dzisiaj

Aplikacja ma **trzy moduły**: standardowy generator ofert (Angebot),
Kreator CV i franczyzowy generator ofert. Ograniczony jest wyłącznie
franczyzobiorca — widzi swój generator i nic poza nim.

| Rola | Angebot | Kreator CV | Franchise | Meine Angebote | Panel admina |
| --- | --- | --- | --- | --- | --- |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user` (konsultant) | ✅ | ✅ | ❌ | ❌ | ❌ |
| `franchise` | ❌ | ❌ | ✅ | ✅ | ❌ |

**Zakładka Franchise** — układ i styl jak w Angebot, jedna kolumna:
dane klienta → dane podstawowe → wybór pakietu → *Ihre Kalkulation*
(cena zakupu, prowizja, cena sprzedaży) → dodatki → odliczenia →
podsumowanie. Przeliczanie na żywo przy każdym wciśnięciu klawisza.

**Zakładka Meine Angebote** — tabela zapisanych ofert: Kunde (nazwisko, imię,
data oferty), Produkt, Preis / Monat, Erstellt am. Szukanie po imieniu
i nazwisku ze składaniem umlautów. Kliknięcie w wiersz wczytuje ofertę
i wraca na kalkulator. Usuwanie z potwierdzeniem w wierszu.

**PDF** — przycisk zapisuje gotowy plik, bez okna drukowania. Nazwa składana
z danych klienta. Cztery strony: oferta w układzie dokumentu handlowego
(kolory firmowe), opis pakietów językowych, ogólny opis usługi, opis
dodatków. Opisy przepisywane z zakładki Angebot w chwili zapisu — jedno
źródło treści dla obu ofert.

**Czego klient nigdy nie zobaczy:** ceny zakupu i prowizji. Dokument PDF
jest budowany osobno i dostaje wyłącznie kwoty końcowe — te dwie liczby
nie mają w nim żadnej reprezentacji. Na wydruku z przeglądarki chroni je
dodatkowo blok `calc-settings`, zdejmowany ze strony regułą wydruku.

---

## Etapy 1–3 ✅

- [x] Repozytorium prywatne, dwie gałęzie, `package.json`, Docker, Railway
- [x] Klucz API wyjęty z kodu do zmiennej środowiskowej
- [x] Cała aplikacja na PostgreSQL, `db.js`, migracje uruchamiane przy starcie
- [x] Rola `franchise` jako rola wyłączająca, egzekwowana po stronie API
- [x] Zamknięta dziura: `requireApiKey` wymaga tokenu JWT, nie samego klucza
- [x] Cennik i wyliczenia po stronie serwera, historia ofert, izolacja po `user_id`
- [x] Szukanie ze składaniem umlautów

## Etap 4 — Interfejs ✅

- [x] Ekran kalkulatora z przeliczaniem na żywo
- [x] Podgląd oferty dla klienta — tylko kwoty końcowe
- [x] Wydruk i PDF — stopka wyłącznie centrali
- [x] Panel historii ofert (osobna zakładka)
- [x] Rola w panelu admina i ukrywanie zakładek według roli
- [x] Link do ustawienia hasła wystawiany przez administratora

### Dodatkowo, poza pierwotnym zakresem

- [x] Układ zakładki przebudowany na wzorzec Angebot
- [x] PDF jako osobny dokument w kolorach firmowych, cztery strony
- [x] Konta dezaktywowane zamiast usuwanych, oferty przeżywają konto

### Błędy znalezione i naprawione po drodze

| Co | Skutek przed naprawą |
| --- | --- |
| `PUT /users/:id` nadpisywał wszystkie pola | Dezaktywacja administratora kasowała nazwę konta i degradowała go do zwykłego użytkownika |
| Powrót z „2 Personen" na „1 Person" | Dodatek 15 €/dzień zostawał zaznaczony — oferta dla jednego pacjenta niosła 450 €/mies. za nieistniejącą drugą osobę |
| `ON DELETE CASCADE` na ofertach | Usunięcie konta franczyzobiorcy kasowało po cichu całą jego historię ofert |
| Kwota Express w kolumnie o stałej szerokości | Na wydruku „300,00 € (einmalig" bez końca |
| PDF na dwóch stronach | Druga strona prawie pusta |
| Pigułki Pro Tag / Pro Monat w PDF | Traciły tło i kolory |
| Podwójne punktory na stronie opisowej PDF | Style z Angebot nakładały się na układ dokumentu |

## Etap 5 — Domknięcie ✅

- [x] Środowisko testowe Railway działa
- [x] Blok `location /franchise/` w `nginx-calculator.conf`
- [x] Konto administratora założone, zmienne `BOOTSTRAP_ADMIN_*` usunięte
- [x] Naprawiony błąd CORS blokujący każde logowanie
- [x] Repozytorium zrównane z GitHubem, `git push` działa z terminala
- [ ] Przejście produkcji na PostgreSQL — **odłożone decyzją PO**
- [ ] Powrót modułu do repozytorium firmowego — **odłożone decyzją PO**

---

## Co zostało sprawdzone i jak

**W przeglądarce, na uruchomionej stronie — 77 z 77 testów.** Uprawnienia
trzech ról, blokada przełączania zakładek z konsoli, zgodność kwot
z cennikiem, dwóch pacjentów, Express liczony jednorazowo, walidacja
prowizji, brak ceny bazowej i prowizji w ofercie, na wydruku i w dokumencie
PDF, format tabeli historii, usuwanie bez okna przeglądarki, liczba i tytuły
stron PDF, oraz to, że zakładka Angebot nadal poprawnie liczy.

**Na prawdziwym PostgreSQL 16** — migracje 001–004 wykonują się po kolei bez
błędu; migracja 004 jest idempotentna; więź klucza obcego to RESTRICT;
**próba usunięcia konta z ofertami jest odrzucana przez bazę, a oferta
zostaje**; konto bez ofert nadal da się usunąć; kolumna `role` przyjmuje
`admin`, `user`, `franchise` i odrzuca cokolwiek innego; tabela
`password_resets` istnieje ze wszystkimi kolumnami.

**Przez odczyt kodu** — `/cv/*` i `/ai/generate` przechodzą przez
`requireApiKey`, który jest złożeniem `requireAuth` + `denyFranchise`, więc
konto franczyzowe dostaje 403 na każdej z nich. `/users*` wymaga
`requireAdmin`. `DELETE /users/:id` zwraca 405 bezwarunkowo. Token linku do
hasła ma ważność 1 godziny (`RESET_TOKEN_HOURS`).

**Potwierdzone przez PO na środowisku testowym** — izolacja ofert: jeden
franczyzobiorca nie widzi ofert drugiego.

### Zostało do kliknięcia na Railway

- [ ] `POST /users/:id/reset-link` — link faktycznie otwiera ustawienie hasła
      i przestaje działać po godzinie
- [ ] Próba usunięcia konta w panelu admina — komunikat o dezaktywacji

---

## Decyzje podjęte

| Sprawa | Decyzja PO |
| --- | --- |
| Która cena wiążąca | Miesięczna; przelicznik na dzień zmienny per pakiet |
| Rabat kwotowy | Brak — tylko prowizja |
| Widełki prowizji | Brak limitów |
| Dwóch pacjentów | Tak, wyłącznie przez stawkę dodatku 15 €/dzień |
| Prowizja na dodatkach | Nie |
| Odliczenia | Przełącznik, domyślnie wyłączone |
| 12 dni świątecznych | Tylko notka informacyjna |
| Historia ofert | Tak, per użytkownik, osobna zakładka |
| Dane na wydruku | Tylko centrala Betreuung 24 |
| Baza | PostgreSQL na Railway |
| Plan Railway | Zostaje próbny |
| Eksport ofert, raport prowizji | Nie robimy |
| Zakres prac | Tylko generator ofert; modułu CV nie rozwijamy |
| Zmiana hasła | Administrator wysyła link do ustawienia hasła |
| Moduły aplikacji | Trzy: Angebot, Kreator CV, Franchise. Ograniczony tylko franczyzobiorca |
| Kasowanie ofert po czasie | Nie kasujemy |
| Kasowanie kont | Nie usuwamy — dezaktywujemy. Oferty przeżywają konto |
| Kolejność na ekranie | Najpierw produkt, potem prowizja |
| Przycisk PDF | Zapisuje plik, bez okna drukowania. Tylko w zakładce Franchise |
| Strony opisowe w PDF | Wszystkie trzy, te same co w zwykłej ofercie |

## Wymaga decyzji

1. **Plan Railway** — zostało 28 dni albo 4,95 USD. Żadnych działań
   w kierunku płatności bez zgody PO.
2. **Wdrożenie produkcyjne** — kiedy i czy. Produkcja stoi na gałęzi `main`,
   na SQLite, nietknięta. Przed wdrożeniem trzeba świadomie potwierdzić
   przejście produkcji na PostgreSQL i wykonać jednorazową migrację danych.

## Środowiska

| Gdzie | Adres | Stan |
| --- | --- | --- |
| Railway (test) | `angebot-calculator-betreuung24-production.up.railway.app` | działa, gałąź `feature/franchise-calculator` |
| Railway (baza) | usługa `Postgres` w projekcie `believable-upliftment` | działa, własny dysk |
| Lokalnie | `http://localhost:3001` | `docker compose up` |
| Produkcja | `calculator.betreuung24.de` | **nietknięta**, gałąź `main`, SQLite |

## Dostęp z terminala

| Usługa | Stan |
| --- | --- |
| GitHub | działa w pełni — sieć odblokowana, uwierzytelnienie ustawione, `git push` z terminala |
| Railway | blokowany (proxy zwraca 403) — obsługa przez przeglądarkę |
| npm (kontener Claude) | blokowany polityką egress; biblioteki z komputera są pod ARM, więc całej aplikacji nie da się postawić po stronie Claude |

## Uwagi techniczne dla kolejnej sesji

- Biblioteka `html2pdf.bundle.min.js` leży w repozytorium i jest serwowana
  z własnej domeny, nie z CDN-a. Wczytuje się dopiero przy pierwszym
  kliknięciu w przycisk PDF.
- Przełącznik `FR_CV_ENABLED` w `index.html` włącza i wyłącza zakładkę
  Kreator CV dla ról `admin` i `user`. Dziś `true`.
- Przy każdym zerwaniu połączenia z komputerem gaśnie zgoda na kasowanie
  plików, a git zostawia `.git/HEAD.lock`. Jeśli commit zawiedzie z „File
  exists" — usunąć ten plik albo odsunąć go pod inną nazwą.
