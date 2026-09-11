# Betreuung 24 — Angebot Calculator + CV Generator + Franchise

Kopia robocza aplikacji. Praca nad modułem franczyzowym toczy się
na gałęzi `feature/franchise-calculator`.

Dokumentacja projektu (tryb pracy, cennik franczyzowy, specyfikacja modułu)
znajduje się w wiedzy projektu Claude, nie w tym repozytorium.

## Środowiska

| Gdzie | Po co | Adres |
| --- | --- | --- |
| Twój Mac (Docker) | szybkie sprawdzanie zmian | http://localhost:3001 |
| Railway | środowisko testowe do pokazywania innym | link z panelu Railway |
| Hetzner | produkcja — **nie ruszamy** | https://calculator.betreuung24.de |

Produkcja działa z repozytorium firmowego, z gałęzi `main` i bazy SQLite,
i nie jest połączona z tym repo.

## Baza danych

Aplikacja używa **PostgreSQL**. Schemat zakłada się sam: przy każdym starcie
serwer wykonuje pliki z katalogu `migrations/` w kolejności numerów i zapisuje
w tabeli `schema_migrations`, które już wykonał. Drugi start nic nie robi.

Nigdy nie edytuj pliku migracji, który już się wykonał — dodaj nowy z wyższym
numerem.

## Uruchomienie na własnym komputerze

Potrzebny **Docker Desktop** (uruchomiony — ikonka wieloryba w górnym pasku).

```bash
# 1. Jednorazowo: utwórz plik z hasłami na podstawie wzoru
cp .env.example .env

# 2. Wygeneruj dwa klucze i wklej je do .env
openssl rand -hex 32   # to wklej jako API_KEY
openssl rand -hex 32   # to wklej jako JWT_SECRET

# 3. Uruchom (pierwszy raz potrwa kilka minut — buduje się obraz)
docker compose up --build
```

Aplikacja: **http://localhost:3001**

Zatrzymanie: `Ctrl + C` w tym samym okienku.

### Pierwsze konto na nowym środowisku (Railway)

Świeże środowisko nie ma żadnego konta, więc nie ma się czym zalogować.
Ustaw w panelu Railway trzy zmienne:

```
BOOTSTRAP_ADMIN_EMAIL     = twoj@email.de
BOOTSTRAP_ADMIN_PASSWORD  = (minimum 8 znaków)
BOOTSTRAP_ADMIN_NAME      = Imię Nazwisko
```

Przy najbliższym starcie aplikacja utworzy z nich **jedno konto administratora**.

Zabezpieczenie: kod odpala się **wyłącznie wtedy, gdy tabela użytkowników jest
całkowicie pusta**. Nie nadpisze istniejącego konta, nie zmieni hasła i nie
odtworzy konta usuniętego. Gdy pierwszy administrator już istnieje, w logu
pojawia się `Bootstrap skipped` i zmienne można usunąć — nie mają dalej
żadnego działania.

Wszystkie kolejne konta zakłada administrator z panelu.

### Konta testowe lokalnie

W drugim okienku Terminala, gdy aplikacja działa:

```bash
# Administrator — widzi wszystko
docker compose exec app node create-admin.js admin@local.test Haslo1234 "Admin Lokalny" admin

# Konsultant — Angebot + Kreator CV
docker compose exec app node create-admin.js kons@local.test Haslo1234 "Konsultant" user

# Franczyzobiorca — TYLKO kalkulator franczyzowy
docker compose exec app node create-admin.js fran@local.test Haslo1234 "Test Franczyza" franchise
```

### Start od zera (czyści bazę lokalną)

```bash
docker compose down -v
docker compose up --build
```

To bezpieczne — lokalna baza zawiera wyłącznie Twoje testy.

## Role użytkowników

| Rola | Angebot | Kreator CV | Baza CV | Franchise | Panel admina |
| --- | --- | --- | --- | --- | --- |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `franchise` | ❌ | ❌ | ❌ | ✅ | ❌ |

Rola `franchise` jest **wyłączająca**: konto z tą rolą dociera do kalkulatora
franczyzowego i do niczego więcej. Blokada działa po stronie serwera, nie tylko
przez ukrycie zakładek — wywołanie API z pominięciem interfejsu też dostaje `403`.

## Czego nie ma w Dockerze i na Railway

| Funkcja | Dlaczego | Co zobaczysz |
| --- | --- | --- |
| Generator AI (Ollama + Mistral) | model nie zmieści się poza serwerem produkcyjnym | komunikat „Generator AI nie jest dostępny w tym środowisku" |
| Reset hasła e-mailem | brak konfiguracji SMTP | hasła ustawia administrator |
| Nocny backup bazy | robi to dostawca bazy (Railway automatycznie) | — |

## Sprawdzenie po edycji

```bash
npm run check-js      # składnia server.js, db.js, create-admin.js
npm run check-html    # składnia skryptów w index.html — po KAŻDEJ edycji
```

Wszystkie skrypty muszą wypisać `OK`.

## Zmienne środowiskowe

| Zmienna | Domyślnie | Znaczenie |
| --- | --- | --- |
| `DATABASE_URL` | — | **wymagana**; adres bazy PostgreSQL |
| `PGSSL` | — | `require` gdy baza wymaga TLS (Railway) |
| `API_KEY` | — | klucz API; wstawiany do `index.html` przy serwowaniu strony |
| `JWT_SECRET` | — | podpisywanie sesji logowania |
| `PORT` | `3001` | port aplikacji (Railway ustawia własny) |
| `HOST` | `127.0.0.1` | adres nasłuchu; w kontenerze musi być `0.0.0.0` |
| `CV_DATA_DIR` | `./cv-data` | zdjęcia opiekunek i logi (nie baza) |
| `STATIC_DIR` | katalog aplikacji | skąd serwowane są pliki strony |
| `AI_DISABLED` | — | `1` wyłącza generator AI |
| `SMTP_USER`, `SMTP_PASS` | — | konto do wysyłki e-maili |

Klucz API **nie jest zapisany w kodzie**. W `index.html` stoi atrapa
`__API_KEY_PLACEHOLDER__`, którą serwer podmienia na wartość ze zmiennej
środowiskowej przy każdym wywołaniu strony.

## Endpointy modułu franczyzowego

Wszystkie wymagają zalogowania i roli `franchise` albo `admin`.

```
GET    /franchise/pricing            — cennik (ceny i przeliczniki)
POST   /franchise/calc               — przeliczenie bez zapisu
GET    /franchise/offers             — moje oferty (admin: ?all=1 wszystkie)
GET    /franchise/offers/search?q=   — szukanie po kliencie
GET    /franchise/offers/:id         — jedna oferta
POST   /franchise/offers             — zapis nowej
PUT    /franchise/offers/:id         — aktualizacja własnej
DELETE /franchise/offers/:id         — usunięcie własnej
```

Kwoty są liczone **na serwerze** i zapisywane razem z ofertą. Gdy centrala
zmieni cennik, oferty już wystawione pokazują kwoty z dnia wystawienia.

Odwołanie do cudzej oferty zwraca `404`, nie `403` — żeby nie ujawniać,
że taki rekord istnieje.

## Uwaga o produkcji (Nginx)

Nginx przekazuje do aplikacji **tylko wymienione ścieżki**. Blok
`location /franchise/` w `nginx-calculator.conf` jest już dopisany — bez niego
produkcja zwracałaby `index.html` zamiast odpowiedzi API.
