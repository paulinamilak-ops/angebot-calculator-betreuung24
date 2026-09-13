# ROADMAP — moduł franczyzowy Betreuung 24

Stan na **13.09.2026, 09:15** · gałąź `feature/franchise-calculator`
Wersja interaktywna (artefakt Claude): utrzymywana równolegle, ten plik jest
kopią w repozytorium.

**Postęp: 25 / 27 zadań. Etapy 1–4 zamknięte, kod etapu 4 jest na GitHubie.
Zostały dwie pozycje odłożone decyzją PO.**

| Etap | Zakres | Stan |
| --- | --- | --- |
| 1 | Fundament — repozytorium i środowiska | ✅ 5/5 |
| 2 | Baza danych i uprawnienia | ✅ 5/5 |
| 3 | Backend modułu franczyzowego | ✅ 4/4 |
| 4 | Interfejs — zakładka Franchise | ✅ 6/6 |
| 5 | Domknięcie | ⬜ 5/7 — zostały dwie pozycje odłożone decyzją PO |

---

## Etap 1 — Fundament ✅

- [x] Prywatne repozytorium GitHub `paulinamilak-ops/angebot-calculator-betreuung24`,
      gałęzie `main` (punkt odniesienia) i `feature/franchise-calculator`
- [x] `package.json` — nie istniał w repozytorium, lista była tylko w komentarzu
      na górze `server.js`
- [x] Uruchomienie w kontenerze — `PORT` i nowa zmienna `HOST`, `express.static`
      gdy nie ma Nginxa
- [x] Klucz API wyjęty z kodu — atrapa `__API_KEY_PLACEHOLDER__` podstawiana
      ze zmiennej środowiskowej przy serwowaniu `index.html`
- [x] Docker lokalnie — `docker compose up` stawia aplikację i Postgres razem

## Etap 2 — Baza i uprawnienia ✅

- [x] `db.js` — warstwa PostgreSQL zachowująca powierzchnię wywołań
      better-sqlite3; `server.js` przepisany (36 wywołań bazy, 17 handlerów)
- [x] `migrations/001–003` uruchamiane przy starcie, w transakcji, raz na plik
- [x] Rola `franchise` — wyłączająca; `denyFranchise` na `/cv/*` i `/ai/generate`,
      `requireFranchise` na `/franchise/*`
- [x] Zamknięta dziura: `requireApiKey` wymaga teraz tokenu JWT
- [x] `create-admin.js` przyjmuje rolę jako czwarty argument

## Etap 3 — Backend franczyzy ✅

- [x] Cennik i wyliczenia po stronie serwera — `/franchise/pricing`, `/franchise/calc`
- [x] Historia ofert — `/franchise/offers` (GET POST PUT DELETE) + `/offers/search`
- [x] Izolacja między franczyzobiorcami — filtr po `user_id` z tokenu, cudza
      oferta zwraca 404
- [x] Szukanie ze składaniem umlautów — „muller" znajduje „Müller"

## Etap 4 — Interfejs ✅ (12.09.2026)

- [x] Ekran kalkulatora w `index.html` — pakiet, prowizja, liczba pacjentów,
      dodatki, przeliczanie na żywo przy każdym wciśnięciu klawisza
- [x] Podgląd oferty dla klienta — wyłącznie kwoty końcowe, dodatki, notka
      o 12 dniach świątecznych
- [x] Wydruk — `@media print`, ukryty panel wejściowy i historia, stopka
      wyłącznie z danymi centrali, jedna strona A4
- [x] Panel „Meine Angebote" — lista, szukanie, wczytanie, usuwanie
      z potwierdzeniem w wierszu (bez `confirm()` przeglądarki)
- [x] Rola w panelu admina (lista, zmiana roli) + ukrywanie zakładek według roli
- [x] Administrator wysyła link do ustawienia hasła — `POST /users/:id/reset-link`,
      token ważny 1 h, link pokazywany administratorowi do skopiowania

### Dodatkowo w etapie 4

- [x] **Trzy moduły, ograniczony tylko franczyzobiorca** — decyzja PO
      z 13.09.2026. Aplikacja ma standardowy generator ofert, Kreator CV
      i franczyzowy generator ofert. Konsultant widzi Angebot i Kreator CV,
      administrator wszystko, franczyzobiorca **wyłącznie** swój generator.
      (Krótkotrwała decyzja z 12.09 o ukryciu Kreatora CV przed wszystkimi
      została wycofana dzień później.)
- [x] **Naprawiony błąd w `PUT /users/:id`** (znaleziony przy okazji, naprawiony
      od razu). Handler nadpisywał `name`, `role` i `active` przy każdym
      żądaniu, z wartościami domyślnymi `name||''` i `role||'user'`. Panel admina
      przy dezaktywacji konta wysyła samo `{ active }` — czyli **kasował nazwę
      konta i degradował administratora do zwykłego użytkownika**. Teraz pole
      nieobecne w żądaniu zachowuje swoją wartość.
- [x] **Naprawiony błąd w przełączniku liczby osób** (znaleziony przez testy).
      Powrót z „2 Personen" na „1 Person" odblokowywał dodatek 15 €/dzień, ale
      zostawiał go zaznaczonym — oferta dla jednego pacjenta niosła 450 €/mies.
      za drugiego. Teraz dodatek jest zwalniany razem z wyborem.

### Jak to sprawdzono

Aplikacja uruchomiona w prawdziwej przeglądarce (Chromium), backend zaślepiony.
**50 z 50 testów przechodzi.** Zakres:

| Obszar | Co sprawdzono |
| --- | --- |
| Uprawnienia | Konto `franchise` widzi tylko swoją zakładkę; przełączenie na Angebot lub Kreator CV z konsoli przeglądarki nie działa. Konto `user` widzi Angebot i Kreator CV, nie widzi Franchise. Admin widzi wszystkie trzy. |
| Kwoty | Cztery pakiety przy prowizji 0 dają dokładnie 77 / 93 / 107 / 120 €/dzień. Silber + 600 € = 3.400,00 €/mies. i 112,93 €/dzień. |
| Dwóch pacjentów | Dodatek 15 €/dzień zaznaczany i blokowany; Gesamt 3.850,00 €/mies.; powrót na 1 osobę zwalnia dodatek. |
| Dodatki | Express liczony jednorazowo, nie ×30. |
| Prowizja | Ujemna → komunikat po niemiecku, oferta niezmieniona. Pusta → Total = cena bazowa, bez błędu. |
| Oferta dla klienta | Brak ceny bazowej, brak słów „Provision" i „Einkaufspreis", stopka centrali, notka o 12 dniach. |
| Wydruk | To samo co wyżej + panel wejściowy i historia usunięte ze strony, kwoty końcowe obecne. |
| Historia | Nazwy w formacie `Nazwisko, Imię — DD.MM.RRRR`; usuwanie potwierdzane w wierszu, bez okna przeglądarki. |
| Składnia | `npm run check-html` — wszystkie 4 skrypty OK. `npm run check-js` — OK. |

**Czego jeszcze nie sprawdzono na żywym serwerze** (wymaga wdrożenia na Railway):
izolacja ofert między dwoma realnymi kontami franczyzowymi, `GET /cv/list` → 403
dla konta `franchise`, oraz nowa końcówka `POST /users/:id/reset-link`.

## Etap 5 — Domknięcie ⬜

- [x] Środowisko testowe uruchomione i sprawdzone
- [x] Blok `location /franchise/` w `nginx-calculator.conf`
- [x] Konto administratora założone i sprawdzone; zmienne `BOOTSTRAP_ADMIN_*`
      usunięte z Railway po udanym logowaniu
- [x] Naprawiony błąd blokujący każde logowanie (adres własnej strony zawsze
      dozwolony przez CORS; obce adresy nadal odrzucane)
- [x] Zrównanie repozytorium lokalnego z GitHubem i wypchnięcie etapu 4.
      Uwierzytelnienie do GitHuba ustawione, `git push` działa z terminala.
      Historia lokalna zrównana z `origin`, etap 4 wypchnięty commitami
      `378fa18`, `09cc458` i kolejnymi.
- [ ] Przejście produkcji na PostgreSQL — **odłożone decyzją PO**
- [ ] Powrót modułu do repozytorium firmowego — **odłożone decyzją PO**
- ~~Trwały dysk na zdjęcia opiekunek~~ — **poza zakresem decyzją PO 11.09.2026**

---

## Kontrola zgodności z cennikiem

Sprawdzone trzykrotnie: na uruchomionym PostgreSQL 16 (backend), na samych
wzorach, i w przeglądarce na gotowej zakładce.

| Pakiet | Przelicznik | Prowizja 0 € | Prowizja 600 €/mies. |
| --- | --- | --- | --- |
| Bronze | 2300 / 77 | 2 300,00 € · **77,00 €/dz.** | 2 900,00 € · 97,09 €/dz. |
| Silber | 2800 / 93 | 2 800,00 € · **93,00 €/dz.** | 3 400,00 € · 112,93 €/dz. |
| Gold | 3200 / 107 | 3 200,00 € · **107,00 €/dz.** | 3 800,00 € · 127,06 €/dz. |
| Platin | 3600 / 120 | 3 600,00 € · **120,00 €/dz.** | 4 200,00 € · 140,00 €/dz. |

Dwóch pacjentów: Silber + prowizja 600 € + druga osoba pod opieką = 3 850,00 €/mies.
Express liczony jednorazowo. Prowizja ujemna i nieistniejący pakiet odrzucane (400).

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
| Historia ofert | Tak, per użytkownik, PostgreSQL |
| Nazwa oferty | Imię + nazwisko klienta + data |
| Dane na wydruku | Tylko centrala Betreuung 24 |
| Baza | PostgreSQL na Railway |
| Plan Railway | Zostaje próbny |
| Eksport ofert | Nie robimy |
| Raport prowizji dla centrali | Nie robimy |
| Zakres prac | Tylko generator ofert; modułu CV nie rozwijamy |
| Zmiana hasła | Administrator wysyła link do ustawienia hasła |
| Pierwsze konto | Jednorazowo ze zmiennych `BOOTSTRAP_ADMIN_*` |
| **Zakładka Kreator CV** | **Zostaje. Decyzja PO 13.09.2026: aplikacja ma trzy moduły, a ograniczony jest wyłącznie franczyzobiorca — widzi tylko swój generator. Zastępuje decyzję z 12.09 o ukryciu Kreatora przed wszystkimi** |
| **Kasowanie ofert po czasie** | **Nie kasujemy. Sprawdzone: nocne czyszczenie o 2:00 dotyka wyłącznie CV, tokenów resetu hasła i logu bezpieczeństwa (12.09.2026)** |
| **Kasowanie kont** | **Kont nie usuwamy — dezaktywujemy. Oferty przeżywają konto (12.09.2026)** |

## Wymaga decyzji

1. Plan Railway próbny: zostało 28 dni albo 4,95 USD. Żadnych działań
   w kierunku płatności bez zgody PO.

## Do sprawdzenia na środowisku testowym

Wymaga działającej aplikacji, więc nie dało się tego zrobić po stronie Claude:

- [ ] Izolacja ofert: franczyzobiorca A nie widzi ofert franczyzobiorcy B
- [ ] Konto `franchise`: `GET /cv/list` i `GET /users` zwracają 403
- [ ] `POST /users/:id/reset-link` — link działa i wygasa po godzinie
- [ ] `DELETE /users/:id` odmawia (405) i pisze o dezaktywacji
- [ ] Migracja 004 wykonała się przy starcie
- [ ] Zapis i wczytanie oferty odtwarza wszystkie pola, w tym prowizję

## Środowiska

| Gdzie | Adres | Stan |
| --- | --- | --- |
| Railway (test) | `angebot-calculator-betreuung24-production.up.railway.app` | działa, gałąź `feature/franchise-calculator` |
| Railway (baza) | usługa `Postgres` w projekcie `believable-upliftment` | działa, własny dysk |
| Lokalnie | `http://localhost:3001` | `docker compose up` |
| Produkcja | `calculator.betreuung24.de` | **nietknięta**, gałąź `main` |

## Dostęp z terminala — stan na 12.09.2026

| Usługa | Stan |
| --- | --- |
| GitHub | **działa w pełni** — sieć odblokowana, uwierzytelnienie ustawione, `git push` z terminala |
| Railway | **nadal zablokowany** (proxy zwraca 403) — obsługa przez wtyczkę Chrome |
| npm (kontener Claude) | zablokowany polityką egress, dlatego pełnej aplikacji nie da się postawić po stronie Claude; testy strony robione w przeglądarce z zaślepionym backendem |
