# ROADMAP — moduł franczyzowy Betreuung 24

Stan na **10.09.2026** · gałąź `feature/franchise-calculator`
Wersja interaktywna (artefakt Claude): utrzymywana równolegle, ten plik jest
kopią w repozytorium.

**Postęp: 15 / 24 zadania. Etapy 1–3 zamknięte, etap 4 następny.**

| Etap | Zakres | Stan |
| --- | --- | --- |
| 1 | Fundament — repozytorium i środowiska | ✅ 5/5 |
| 2 | Baza danych i uprawnienia | ✅ 5/5 |
| 3 | Backend modułu franczyzowego | ✅ 4/4 |
| 4 | Interfejs — zakładka Franchise | ⬜ 0/5 — **następny** |
| 5 | Domknięcie | ⬜ 1/5 |

---

## Etap 1 — Fundament ✅

- [x] Prywatne repozytorium GitHub `paulinamilak-ops/angebot-calculator-betreuung24`,
      gałęzie `main` (punkt odniesienia) i `feature/franchise-calculator`
- [x] `package.json` — nie istniał w repozytorium, lista była tylko w komentarzu
      na górze `server.js`
- [x] Uruchomienie w kontenerze — `PORT` i nowa zmienna `HOST` (produkcja zostaje
      na `127.0.0.1`, kontener dostaje `0.0.0.0`), `express.static` gdy nie ma Nginxa
- [x] Klucz API wyjęty z kodu — atrapa `__API_KEY_PLACEHOLDER__` podstawiana
      ze zmiennej środowiskowej przy serwowaniu `index.html`
- [x] Docker lokalnie — `docker compose up` stawia aplikację i Postgres razem

## Etap 2 — Baza i uprawnienia ✅

- [x] `db.js` — warstwa PostgreSQL zachowująca powierzchnię wywołań
      better-sqlite3; `server.js` przepisany (36 wywołań bazy, 17 handlerów)
- [x] `migrations/001–003` uruchamiane przy starcie, w transakcji, raz na plik
- [x] Rola `franchise` — wyłączająca; `denyFranchise` na `/cv/*` i `/ai/generate`,
      `requireFranchise` na `/franchise/*`
- [x] Zamknięta dziura: `requireApiKey` wymaga teraz tokenu JWT (sam klucz API
      wystarczał, a jest widoczny w źródle strony)
- [x] `create-admin.js` przyjmuje rolę jako czwarty argument

## Etap 3 — Backend franczyzy ✅

- [x] Cennik i wyliczenia po stronie serwera — `/franchise/pricing`, `/franchise/calc`
- [x] Historia ofert — `/franchise/offers` (GET POST PUT DELETE) + `/offers/search`
- [x] Izolacja między franczyzobiorcami — filtr po `user_id` z tokenu, cudza
      oferta zwraca 404
- [x] Szukanie ze składaniem umlautów — „muller" znajduje „Müller"

## Etap 4 — Interfejs ⬜ NASTĘPNY

- [ ] Ekran kalkulatora w `index.html` — pakiet, prowizja, liczba pacjentów,
      dodatki, przeliczanie na żywo
- [ ] Podgląd oferty dla klienta — wyłącznie kwoty końcowe, dodatki, notka
      o 12 dniach świątecznych
- [ ] Wydruk — `@media print`, ukryty panel wejściowy i historia, stopka
      wyłącznie z danymi centrali
- [ ] Panel „Meine Angebote" — lista, szukanie, wczytanie, usuwanie
- [ ] Rola w panelu admina + ukrywanie zakładek według roli

## Etap 5 — Domknięcie ⬜

- [x] Blok `location /franchise/` w `nginx-calculator.conf`
- [ ] Trwały dysk `/data` na Railway (zdjęcia opiekunek)
- [ ] Konta testowe na Railway
- [ ] Przejście produkcji na PostgreSQL — **odłożone decyzją PO**
- [ ] Powrót modułu do repozytorium firmowego — **odłożone decyzją PO**

---

## Kontrola zgodności z cennikiem

Sprawdzone na uruchomionym PostgreSQL 16. Przy prowizji zero stawki dzienne
wychodzą dokładnie jak w cenniku Lizenzpartner z 18.05.2026.

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
| Nazwa oferty | Imię + nazwisko klienta + data, wpisywane ręcznie |
| Dane na wydruku | Tylko centrala Betreuung 24 |
| Baza | PostgreSQL na Railway |
| Plan Railway | Zostaje próbny |
| Eksport ofert | Nie robimy |
| Raport prowizji dla centrali | Nie robimy |

## Wymaga decyzji

1. Czy zaczynamy etap 4 — zakładkę Franchise (osobna sesja).
2. Środowisko testowe nie zostało otwarte i sprawdzone ręcznie — Railway zgłasza
   udane wdrożenie i sam sprawdza `/health`, ale adres Railway jest zablokowany
   z obu terminali przez ustawienia sieci organizacji.
3. Plan Railway próbny: 30 dni albo 5 USD. Trwały dysk może wymagać planu
   płatnego — do sprawdzenia przed dodaniem.

## Środowiska

| Gdzie | Adres | Stan |
| --- | --- | --- |
| Railway (test) | `angebot-calculator-betreuung24-production.up.railway.app` | wdrożone, gałąź `feature/franchise-calculator` |
| Railway (baza) | usługa `Postgres` w projekcie `believable-upliftment` | działa, własny dysk |
| Lokalnie | `http://localhost:3001` | `docker compose up` |
| Produkcja | `calculator.betreuung24.de` | **nietknięta**, gałąź `main`, dotychczasowa baza |
