# Betreuung 24 — Angebot Calculator + CV Generator

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

Produkcja działa z repozytorium firmowego i nie jest połączona z tym repo.

## Uruchomienie na własnym komputerze

Potrzebny **Docker Desktop** (uruchomiony — ikonka wieloryba w górnym pasku).

```bash
# 1. Jednorazowo: utwórz plik z hasłami na podstawie wzoru
cp .env.example .env

# 2. Wygeneruj dwa klucze i wklej je do .env
openssl rand -hex 32   # to wklej jako API_KEY
openssl rand -hex 32   # to wklej jako JWT_SECRET

# 3. Uruchom
docker compose up --build
```

Aplikacja: **http://localhost:3001**

Zatrzymanie: `Ctrl + C` w tym samym okienku.

### Pierwsze konto

W drugim okienku Terminala, gdy aplikacja działa:

```bash
docker compose exec app node create-admin.js admin@local.test Haslo1234 "Admin Lokalny"
```

### Start od zera (czyści bazę lokalną)

```bash
docker compose down -v
docker compose up --build
```

To bezpieczne — lokalna baza zawiera wyłącznie Twoje testy.

## Czego nie ma w Dockerze i na Railway

| Funkcja | Dlaczego | Co zobaczysz |
| --- | --- | --- |
| Generator AI (Ollama + Mistral) | model nie zmieści się poza serwerem produkcyjnym | komunikat „Generator AI nie jest dostępny w tym środowisku" |
| Reset hasła e-mailem | brak konfiguracji SMTP | hasła ustawia administrator |

## Sprawdzenie składni po edycji `index.html`

Obowiązkowe po każdej zmianie:

```bash
npm run check-html
```

Wszystkie trzy skrypty muszą wypisać `OK`.

## Zmienne środowiskowe

| Zmienna | Domyślnie | Znaczenie |
| --- | --- | --- |
| `API_KEY` | — | klucz API; wstawiany do `index.html` przy serwowaniu strony |
| `JWT_SECRET` | — | podpisywanie sesji logowania |
| `PORT` | `3001` | port aplikacji (Railway ustawia własny) |
| `HOST` | `127.0.0.1` | adres nasłuchu; w kontenerze musi być `0.0.0.0` |
| `CV_DATA_DIR` | `./cv-data` | baza, zdjęcia, logi, backupy |
| `STATIC_DIR` | katalog aplikacji | skąd serwowane są pliki strony |
| `AI_DISABLED` | — | `1` wyłącza generator AI |
| `SMTP_USER`, `SMTP_PASS` | — | konto do wysyłki e-maili |

Klucz API **nie jest zapisany w kodzie**. W `index.html` stoi atrapa
`__API_KEY_PLACEHOLDER__`, którą serwer podmienia na wartość ze zmiennej
środowiskowej przy każdym wywołaniu strony.
