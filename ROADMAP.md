# ROADMAP — moduł franczyzowy Betreuung 24

Stan na **28.10.2026** · gałąź `feature/franchise-calculator`
Ostatni commit **`__COMMIT__`** · wypchnięty na GitHub

| Etap | Zakres | Stan |
| --- | --- | --- |
| 1 | Fundament — repozytorium i środowiska | ✅ |
| 2 | Baza danych i uprawnienia | ✅ |
| 3 | Backend modułu franczyzowego | ✅ |
| 4 | Interfejs — zakładka Franchise | ✅ |
| 5 | Domknięcie | ✅ 5/7 — 2 odłożone decyzją PO |
| 6 | Cennik | ✅ cennik z 28.10.2026 wdrożony w obu modułach |
| 7 | Nowy wygląd oferty v9 | 🔄 7.1–7.3 zrobione, 7.4 następne |

---

## Sesja 28.10.2026

### Cennik z 28.10.2026 — jeden dla obu modułów

**Decyzja PO:** te same kwoty w zakładce Angebot i w module franczyzowym.
Szczegóły i kontrola po wdrożeniu: `CENNIK-2026-10-28.md`.

| Pakiet | Angebot było | Franczyza było | **Jest, oba moduły** |
| --- | --- | --- | --- |
| Bronze | 2 700 € / 90 € | 2 300 € / 77 € | **2 600 € / 87 €** |
| Silber | 3 100 € / 103 € | 2 800 € / 93 € | **2 900 € / 97 €** |
| Gold | 3 600 € / 120 € | 3 200 € / 107 € | **3 300 € / 110 €** |
| Platin | 3 900 € / 130 € | 3 600 € / 120 € | **3 600 € / 120 €** |

⚠️ **Marża centrali na odsprzedaży franczyzie wynosi teraz 0 € w każdym
pakiecie.** Przed zmianą było 400 / 300 / 400 / 300 € miesięcznie.
Franczyzobiorca zarabia wyłącznie na swojej prowizji. Konsekwencja została
przedstawiona PO przed decyzją — w szczególności to, że Platin w nowym
cenniku to dokładnie dotychczasowa cena zakupu Platinu.

Zmienione trzy miejsca: `products` w `index.html` (Angebot),
`FRANCHISE_PRODUCTS` w `server.js` (źródło prawdy dla Franchise)
i `FR_PRODUCTS` w `index.html` (kopia zapasowa na froncie).

Sprawdzone w przeglądarce: przy prowizji 0 € moduł franczyzowy odtwarza
87 / 97 / 110 / 120 € co do grosza. PDF oferty przeliczony ponownie we
wszystkich trzech wariantach — strona 1 nadal mieści się na A4.

### Commit `724297c` — strona 1 oferty w układzie v9 (krok 7.3)

Pierwsza strona przepisana na układ ze wzorca `reference/silber.html`,
na żywych danych z kalkulatora.

- [x] Nagłówek strony: logo ze wzorca (`offer-logo-b24.png`, ten sam znak
      co `pflegeplus-logo.png`, tylko ciasno przycięty) i adres kontaktowy
      po prawej, pod spodem cienka linia.
- [x] Tytuł „Ihr persönliches Angebot" i adresat w bloku po prawej —
      imię i nazwisko klienta zostaje, zgodnie z decyzją PO z 27.10.
- [x] Trzy tabele o wspólnej siatce kolumn (opis 62% / Pro Tag 15% /
      Pro Monat 23%): wybrana usługa, dodatki, podsumowanie.
      Wybrany produkt podświetlony kolorem z alfą, **nigdy `opacity`**.
- [x] Odliczenia jako osobny blok w tej samej kolorystyce.
- [x] Granatowy pasek kwoty końcowej, bez powiększonych sum.
- [x] Blok opinii: logotypy ProvenExpert i Trustpilot z podpisem
      „Bewertungen ansehen". Bez ocen liczbowych i bez cytatów.
- [x] Stopka: wyłącznie dane centrali, obok `Kunde · data · Kostenübersicht`
      i numer strony.
- [x] Znak minus ujednolicony — wiersz „Abzüge gesamt" miał dywiz,
      reszta półpauzę. Drobiazg z listy „do zrobienia" zamknięty.

**Decyzja PO w trakcie sesji:** nagłówki sekcji „Ausgewählte Dienstleistung",
„Zusatzleistungen" i „Zusammenfassung" dostają **firmowe podkreślenie** —
ten sam rysunek (`underline-curve.png`), który jest pod logo i pod tytułami
sekcji w zakładkach aplikacji. Nagłówek „Abzüge" dostał je również,
dla spójności — **do potwierdzenia przez PO**.

#### Pułapka: podkreślenie rozpychało kolumnę

Obrazek wstawiony w przepływ wnosi do szerokości swoje **757 px**, więc
komórka tabeli rozciągała się na całą kolumnę i podkreślenie szło przez pół
strony zamiast pod napisem. Rozwiązanie: podkreślenie jest **tłem nagłówka**
(`background-size: 100% 1.7mm`), więc skaluje się dokładnie do długości
napisu, a grubość jest stała niezależnie od tego, jak długi jest nagłówek.

#### ⚠️ Błąd z 27.10 zamknięty — strona 1 mieści się na A4

Stary układ wychodził poza kartkę nawet o **256 px**, a poprzedni mechanizm
skalował po cichu całą stronę, przez co strona 1 miała mniejszą czcionkę
niż strony 2–4.

Nowe rozwiązanie: `frFitPage1()` mierzy gotową stronę **w warunkach
renderera** (kartka przycięta do 1123 px) i porównuje dół treści z górą
stopki. Jeśli nie mieści się, dokłada jeden z trzech stopni zagęszczenia
(`v9-tight`, `v9-tighter`, `v9-tightest`). Krótka oferta kończy pętlę na
pierwszym pomiarze i zostaje w proporcjach wzorca — **nic nie jest
skalowane**, zmieniają się tylko odstępy i stopnie pisma.

W najcięższym wariancie (`v9-tightest`) odliczenia idą w dwie kolumny —
to jedyne miejsce, gdzie dało się odzyskać dwa wiersze bez schodzenia
z typografią poniżej czytelności.

#### Sprawdzone renderem serwerowym, bez bazy i bez logowania

Trzy warianty, każdy przez prawdziwy `pdf-renderer.renderOffer()`:

| Wariant | Zagęszczenie | Przelew poza kartkę | Kwota końcowa |
| --- | --- | --- | --- |
| Silber + 600 €, bez dodatków | brak (proporcje wzorca) | — | 112,93 € / 3.400,00 € |
| Silber + 600 €, Führerschein, Pflegegrad 3 | brak | — | **101,00 € / 3.041,00 €** |
| Platin + 1.200 €, 5 dodatków, 2 pacjentów, pełne odliczenia | `v9-tightest` | — | **116,43 € / 3.493,00 €** |

Font Alan Sans załadowany, obrazki na miejscu, 4 strony, tekst zaznaczalny
(1.356–2.079 znaków na stronie 1). **W pliku nie ma ceny zakupu ani
prowizji** — sprawdzone wyszukiwaniem po treści PDF-a.

Kontrola kwot: Platin 3.600 + 1.200 = 4.800 €/mies., przelicznik 30 →
160 €/dzień; dodatki 37 €/dzień × 30 = 1.110 €; odliczenia 990 + 800 + 294
+ 333 = 2.417 € → 3.493,00 €/mies. i 116,43 €/dzień. Zgadza się co do grosza.

#### Czego ten krok nie obejmuje

Strony 2–4 zostają na **starym układzie** do kroku 7.4 — mają stary nagłówek
i stopkę. W jednym pliku PDF widać więc dwa style. Tak ma być do 7.4.

---

## Sesja 27.10.2026

### Commit `610df52` — stawka dzienna przy odliczeniach

**Decyzja PO:** równamy do przelicznika pakietu.

- [x] `frRenderAbzuege()` dzieliła kwotę odliczeń i kwotę końcową przez
      `FR_DAYS` (30) zamiast przez przelicznik pakietu. Przelicznik jest
      teraz czwartym argumentem funkcji.
- [x] Poprawione **dwie** linie, nie jedna — ten sam błąd był też w wierszu
      „Abzüge gesamt / Tag".
- [x] Silber + 600 € + Führerschein − Pflegegrad 3 → **101,00 €/Tag**
      zamiast 101,37 €. Kwota miesięczna bez zmian (3.041,00 €).
- [x] Zakładka Angebot liczyła to już poprawnie — Franchise był jedynym
      odstępstwem.

### Commit `2147256` — PDF składa Chromium na serwerze

**Decyzja PO:** droga B (render po stronie serwera) oraz wygląd v9
**w obu modułach** — Franchise i Angebot.

- [x] `pdf-renderer.js` — Playwright + Chromium. Przeglądarka startuje
      leniwie przy pierwszym żądaniu i zostaje w pamięci. Ustawienia
      wprost ze specyfikacji v9: A4, `printBackground`, `preferCSSPageSize`,
      `displayHeaderFooter:false`, skala 1, marginesy 0 (są w CSS).
- [x] `POST /pdf/render` — dla każdej zalogowanej roli. Skrypty wycinane
      z treści, zasoby ograniczone do własnego adresu, limit 4 MB.
- [x] `offer-print.css` — styl dokumentu wydzielony z `index.html`.
- [x] `nginx-calculator.conf` — blok `location /pdf/`, `proxy_read_timeout
      120s`, `client_max_body_size 8m`.
- [x] `Dockerfile` — `mcr.microsoft.com/playwright:v1.62.1-noble`.
- [x] `html2pdf.bundle.min.js` usunięty, `Claude outputs/` w `.gitignore`.

#### Pułapka, która kosztowałaby zły font w ofercie

Dokument **musi** dostać własny adres w naszej domenie
(`route.fulfill` + `page.goto`), a nie `page.setContent`. Strona złożona
setContentem ma adres `about:blank`, więc font z `@font-face` jest dla
przeglądarki zasobem obcego pochodzenia i **CORS go odrzuca**. Arkusz
i obrazki przechodzą bez problemu, font nie — i oferta wychodzi zastępczym
krojem. Rozwiązane, opisane w komentarzu w kodzie.

---

## Etap 7 — nowy wygląd oferty v9

Paczka `Betreuung24-Oferta-Pakiet-Wdrozeniowy.zip` (wariant **v9**
z 21.10.2026) leży w folderze „CV oferty", **poza repozytorium**.

| Strona | Treść |
| --- | --- |
| 1 | Kostenübersicht — oferta, dodatki, odliczenia, Gesamt |
| 2 | Sprachpakete — cztery pakiety, wybrany podświetlony |
| 3 | Allgemeine Produktbeschreibung — zakres usługi |
| 4 | Zusatzleistungen — pięć dodatków + blok kontaktowy |

### Podział na kawałki

| Kawałek | Zakres | Stan |
| --- | --- | --- |
| 7.1 | Decyzje: mechanizm PDF i zakres modułów | ✅ B + oba moduły |
| 7.2 | Silnik PDF na serwerze, styl wydzielony do pliku | ✅ `2147256` |
| 7.3 | Strona 1 w układzie v9, na danych z kalkulatora | ✅ `724297c` |
| 7.4 | Strony 2–4: opisy, podświetlenia, blok kontaktowy | ⬜ **następne** |
| 7.5 | To samo w zakładce Angebot | ⬜ |
| 7.6 | Odtworzenie obu przykładów i porównanie ze wzorcami | ⬜ |

### Stałe wizualne v9

| Element | Wartość |
| --- | --- |
| Strony | 4 × A4, 210 × 297 mm, pionowo |
| Obszar strony | `padding: 15mm 17mm 0` |
| Font | Alan Sans (we wzorcu rodzina `Alan`) |
| Granat | `--navy #0d1b3e` — ✅ decyzja PO 28.10: kolory aplikacji |
| Pomarańcz | `--orange #f7a800` — ✅ decyzja PO 28.10: kolory aplikacji |
| Tło wybranego pakietu | kolor z alfą `.08`, obrys `.28` |
| Zaokrąglenie wyboru | 1,5 mm |
| Kwoty w granatowym podsumowaniu | 11,5 pt, weight 550, line-height 1.2 |
| Podkreślenie nagłówków sekcji | `underline-curve.png` jako tło, wysokość 1,7 mm |
| Kontakt na stronie 4 | `0800 723 5 723`, link `tel:08007235723` |

Zakazane: `opacity` na kontenerze (przyciemnia tekst — użyć koloru z alfą),
pionowe kolorowe paski, cienie, gradienty, powiększone sumy.

Uwaga o gramaturach: wzorzec używa fontu zmiennego i wag 450/550/650.
My mamy kroje statyczne, więc 550 → 600, 650 → 700, a 450 (etykiety
kolumn „Pro Tag" / „Pro Monat") ustawione wprost na 400, bo zaokrągliłoby
się w górę do 500 i etykiety wyszłyby za ciężkie.

### ⚠️ Blokada — wzorce pochodzą z dwóch różnych cenników

| Wzorzec | Baza | Z czego wynika |
| --- | --- | --- |
| `silber.html` | 96,32 € / 2.900,00 € | cennik franczyzowy 18.05.2026 + prowizja 100 € |
| `bronze-abzuege.html` | 90 € / 2.700 € | cennik Angebot 01.10.2026 |

Silber jest wzorcem dla Franchise, Bronze dla Angebot. **Uwaga:** po zmianie
cennika z 28.10 żaden z nich nie odtworzy się kwotowo jeden do jednego —
w kroku 7.6 porównujemy **układ**, nie liczby.

### Silnik przeglądarki a zgodność 1:1

Wzorce zrobiono Playwrightem 1.62.1 **z podstawionym** Chrome for Testing
136. Pobieranie przeglądarek jest zablokowane poza Railway. Idziemy
oficjalnym obrazem Playwright (wersja przypięta w tagu). Gotowy PDF idzie
do PO do zatwierdzenia w kroku 7.6.

---

## Decyzje podjęte

| Sprawa | Decyzja PO |
| --- | --- |
| Która cena wiążąca | Miesięczna; przelicznik na dzień zmienny per pakiet |
| Przelicznik w module Angebot | ✅ 14.10 — zmienny per pakiet |
| Cennik Angebot od 01.10.2026 | ✅ 14.10 — wdrożony |
| Cennik franczyzowy | ✅ 14.10 — **też się zmienia**, kwoty nieprzekazane |
| Stawka dzienna przy odliczeniach | ✅ 27.10 — przelicznik pakietu |
| Imię klienta w nagłówku oferty | ✅ 27.10 — **zostaje** |
| Konto testowe na Railway | ✅ 27.10 — **dezaktywować** (niewykonane) |
| Mechanizm PDF | ✅ 27.10 — **droga B**, render po stronie serwera |
| Zakres wyglądu v9 | ✅ 27.10 — **oba moduły** |
| Podkreślenie pod nagłówkami sekcji | ✅ 28.10 — **tak**, rysunek spod logo |
| Podkreślenie pod „Abzüge" | ✅ 28.10 — **zostaje** |
| Kolory oferty | ✅ 28.10 — **kolory aplikacji** `#0d1b3e` / `#f7a800` |
| Cennik od 28.10.2026 | ✅ 28.10 — **jeden dla obu modułów**, marża centrali 0 € |
| Rabat kwotowy | Brak — tylko prowizja |
| Widełki prowizji | Brak limitów |
| Dwóch pacjentów | Tak, wyłącznie przez dodatek 15 €/dzień |
| Prowizja na dodatkach | Nie |
| Odliczenia | Przełącznik, domyślnie wyłączone |
| 12 dni świątecznych | Tylko notka informacyjna |
| Historia ofert | Tak, per użytkownik, osobna zakładka |
| Dane na wydruku | Tylko centrala Betreuung 24 |
| Baza | PostgreSQL na Railway |
| Eksport ofert, raport prowizji | Nie robimy |
| Zakres prac | Tylko generator ofert; modułu CV nie rozwijamy |
| Zmiana hasła | Administrator wysyła link do ustawienia hasła |
| Kasowanie ofert po czasie | Nie kasujemy |
| Kasowanie kont | Nie usuwamy — dezaktywujemy |
| Przycisk PDF | Zapisuje plik, bez okna drukowania |

## Wymaga decyzji

1. **Wdrożenie produkcyjne** — kiedy i czy. Produkcja stoi na `main`,
   na SQLite, nietknięta, ze **starym cennikiem** (2 700 / 3 100 / 3 600 /
   3 900 €). Konsultanci wystawiają dziś oferty po starych cenach.

## Do zrobienia niezależnie od etapów

- [ ] **Dezaktywacja konta** `test-franczyza@pflegeplus.de` na Railway.
- [ ] Cztery drobiazgi z panelu admina (decyzja PO 14.10: poprawiamy później):
      natywny `confirm()` w `adminToggleUser()`; komunikat „Invalid or
      expired reset link" po angielsku; ekran *Neues Passwort* pokazywany
      dla nieważnego linku; okno dezaktywacji po niemiecku w polskim panelu.
- [ ] Kliknięcie „Deaktivieren" w panelu — do sprawdzenia przez PO
      w zwykłym Chrome (panel przeglądarki Claude nie pokazuje `confirm()`).

---

## Co moduł robi dzisiaj

Trzy moduły: Angebot, Kreator CV, franczyzowy generator ofert.

| Rola | Angebot | Kreator CV | Franchise | Meine Angebote | Panel admina |
| --- | --- | --- | --- | --- | --- |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `user` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `franchise` | ❌ | ❌ | ✅ | ✅ | ❌ |

**Czego klient nigdy nie zobaczy:** ceny zakupu i prowizji.

### Błędy znalezione i naprawione po drodze

| Co | Skutek przed naprawą |
| --- | --- |
| `PUT /users/:id` nadpisywał wszystkie pola | Dezaktywacja admina kasowała nazwę konta |
| Powrót z „2 Personen" na „1 Person" | Dodatek 15 €/dzień zostawał — 450 €/mies. za nic |
| `ON DELETE CASCADE` na ofertach | Usunięcie konta kasowało po cichu historię |
| Kwota Express w kolumnie o stałej szerokości | Na wydruku tekst ucięty |
| PDF na dwóch stronach | Druga strona prawie pusta |
| Pigułki Pro Tag / Pro Monat w PDF | Traciły tło i kolory |
| Podwójne punktory na stronie opisowej PDF | Style z Angebot nakładały się |
| Stawka dzienna przy odliczeniach dzielona przez 30 | 101,37 € zamiast 101,00 € |
| Font blokowany przez CORS w rendererze | Oferta wyszłaby zastępczym krojem |
| Strona 1 nie mieściła się na A4 | Cała strona skalowana po cichu, mniejsza czcionka |
| Podkreślenie nagłówka rozpychało kolumnę | Kreska szła przez pół strony zamiast pod napisem |

---

## Środowiska

| Gdzie | Adres | Stan |
| --- | --- | --- |
| Railway (test) | `angebot-calculator-betreuung24-production.up.railway.app` | commit `21ed63f` |
| Railway (baza) | usługa `Postgres` w projekcie `believable-upliftment` | ✅ |
| Lokalnie | `http://localhost:3001` | `docker compose up` |
| Produkcja | `calculator.betreuung24.de` | **nietknięta**, `main`, SQLite |

## Dostęp z terminala

| Usługa | Stan |
| --- | --- |
| GitHub z komputera PO | ✅ działa (folder „CV oferty") |
| npm z komputera PO | ✅ działa |
| Docker w VM na komputerze PO | ❌ brak |
| Pobieranie przeglądarek (Playwright/CfT) | ❌ blokowane wszędzie poza Railway |
| GitHub / Railway / npm z kontenera Claude | ❌ blokowane polityką sieci |
| Playwright + Chromium w kontenerze Claude | ✅ gotowy, wersja 153 |

## Uwagi techniczne dla kolejnej sesji

- **Logowanie do GitHuba trzeba odtwarzać w każdej sesji.** `gh auth login
  --web` nie zadziała — proces w tle ginie po zakończeniu komendy. Działa
  ręczny device flow przez `curl`: POST
  `https://github.com/login/device/code` z `client_id=178c6fc778ccc68e1d6a`
  i `scope=repo`, PO wkleja kod na `github.com/login/device`, potem POST
  `/login/oauth/access_token`; token do `~/.git-credentials`, w repozytorium
  `git config credential.helper "store --file=$HOME/.git-credentials"`.
- `gh auth login --with-token` odrzuca token bez zakresu `read:org`.
- **Zgoda na kasowanie plików** w folderze „CV oferty" jest konieczna —
  git zostawia `.git/HEAD.lock` i `tmp_obj_*`. Gaśnie z sesją.
- Folder na komputerze PO: **„CV oferty"**, repozytorium w `betreuung24`.
- **Sprawdzanie PDF-ów:** PyMuPDF jest tylko w kontenerze Claude
  (`pip install pymupdf --break-system-packages`).
- **Kontrola cennika:** `cennik.cjs` — otwiera `index.html` w Playwrighcie,
  przechodzi cztery pakiety przy prowizji 0 € i 600 €, porównuje z cennikiem.
- **Test renderu bez bazy i bez logowania:** `harness.cjs` — mały serwer
  statyczny na plikach repozytorium, Playwright otwiera `index.html`,
  ustawia pola `fr-*`, woła `frRecalc()` i `frBuildPdfDoc()`, oddaje
  `#fr-pdf-doc.innerHTML`, a to idzie do `pdf-renderer.renderOffer()`.
  Trzy warianty: bez dodatków, z odliczeniami, maksymalny.
  **Playwright działa tylko w kontenerze Claude** — pliki repozytorium
  trzeba tam przenieść.
- `page.evaluate` z napisem liczy go jako wyrażenie — sama strzałka zwróci
  funkcję, nie wynik.
- Ceny Angebot w `index.html` (`products`), franczyzowe w `server.js`
  (`FRANCHISE_PRODUCTS`) — dwa różne miejsca.
- `frRenderAbzuege()` przyjmuje czwarty argument `divisor`.
- **Strona 1 oferty:** klasy z przedrostkiem `.v9-` w `offer-print.css`.
  Przedrostek nie jest ozdobą — `#fr-pdf-doc` siedzi w DOM-ie `index.html`,
  więc nazwy w rodzaju `.total` czy `.trust` zderzyłyby się ze stylami
  zakładek. Strony 2–4 nadal na klasach `.fr-pdf-*`.
- `frFitPage1()` mierzy stronę 1 **w warunkach renderera** (wysokość
  ustawiona na 1123 px, `overflow:hidden`) — inaczej pomiar na ekranie
  wychodzi inny niż w PDF-ie.
- Przełącznik `FR_CV_ENABLED` w `index.html`. Token sesji:
  `sessionStorage`, klucz `b24_token`. Panel przeglądarki Claude nie
  pokazuje okien `confirm()`.
- Po każdej edycji `index.html`: `npm run check-html`.
  Po edycji JS serwera: `npm run check-js`.
