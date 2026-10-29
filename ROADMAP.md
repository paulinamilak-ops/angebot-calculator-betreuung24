# ROADMAP — moduł franczyzowy Betreuung 24

Stan na **29.10.2026** · gałąź `feature/franchise-calculator`
Ostatni commit **`816b42f`** · wypchnięty na GitHub

| Etap | Zakres | Stan |
| --- | --- | --- |
| 1 | Fundament — repozytorium i środowiska | ✅ |
| 2 | Baza danych i uprawnienia | ✅ |
| 3 | Backend modułu franczyzowego | ✅ |
| 4 | Interfejs — zakładka Franchise | ✅ |
| 5 | Domknięcie | ✅ 5/7 — 2 odłożone decyzją PO |
| 6 | Cennik | ✅ cennik z 28.10.2026 wdrożony w obu modułach |
| 7 | Nowy wygląd oferty v9 | 🔄 7.1–7.5 zrobione, 7.6 zostaje |
| 8 | Cenniki w panelu administratora | ✅ 8.1–8.3 zrobione |

---

## Etap 8 — cenniki w panelu administratora

Cennik przestaje być PDF-em i kodem. Administrator tworzy go w panelu,
wybiera rodzaj — **zwykły** (zakładka Angebot) albo **franczyzowy**
(moduł Franchise) — i wpisuje kwoty. Generator ofert bierze cennik
odpowiedni dla modułu.

| Kawałek | Zakres | Stan |
| --- | --- | --- |
| 8.1 | Baza i API cenników | ✅ `307df42` |
| 8.2 | Zakładka „Preislisten" w panelu admina | ✅ `307df42` |
| 8.3 | Generatory biorą cennik z bazy | ✅ `816b42f` |

### Decyzje PO z 29.10.2026

| Sprawa | Decyzja |
| --- | --- |
| Co edytujemy | Pakiety i dodatki. Odliczenia (Pflegegeld, Verhinderungspflege, Steuerersparnis) zostają w kodzie — to stawki ustawowe, nie decyzja cenowa |
| Zmiana w czasie | Cenniki z datą obowiązywania; nowy startuje sam w swoim dniu, stare zostają na liście |
| Kwoty startowe | Oba cenniki zakładane z dzisiejszymi kwotami (2.600/87, 2.900/97, 3.300/110, 3.600/120) |

### Commit `307df42` — baza, API i panel (8.1 + 8.2)

- [x] **Tabela `price_lists`** (migracja `005`): rodzaj, nazwa, data
      obowiązywania, kwoty pakietów i dodatków. Para rodzaj + data jest
      unikalna — dwa cenniki na ten sam dzień czyniłyby z wyboru loterię.
      Migracja zakłada od razu oba cenniki na kwotach z 28.10.2026.
- [x] **Cennik to same kwoty.** Nazwy pakietów i dodatków oraz to, który
      dodatek jest jednorazowy, zostają w kodzie: literówka w nazwie
      trafiłaby prosto na ofertę dla klienta.
- [x] **Endpointy** `/pricing/*`: lista, zapis, edycja, kasowanie (tylko
      administrator) oraz `/pricing/active` — obowiązujący cennik dla roli.
      Nowy blok `location /pricing/` w `nginx-calculator.conf`.
- [x] **Zakładka „💶 Preislisten"** w panelu administratora: formularz
      z wyborem rodzaju i datą, kwoty czterech pakietów i pięciu dodatków,
      lista cenników z oznaczeniem „obowiązuje" i „od DD.MM.RRRR" dla
      przyszłych. Kasowanie z potwierdzeniem na samym przycisku — okno
      `confirm()` nie pokazuje się w panelu przeglądarki Claude.

### Commit `816b42f` — generatory biorą cennik z bazy (8.3)

**Zgłoszenie PO:** „zmieniłam zwykły cennik, ale nie widzę odzwierciedlenia
w zakładce Angebot".

- [x] **Zakładka Angebot** pobiera zwykły cennik po zalogowaniu
      (`/pricing/active?kind=standard`) i nadpisuje nim kwoty pakietów
      i dodatków.
- [x] **Moduł franczyzowy** liczy z cennika franczyzowego — i to **po
      stronie serwera**, więc zapisana oferta nie może mieć kwot
      sprzecznych z cennikiem. `/franchise/pricing` oddaje cennik z bazy
      razem z informacją, z którego cennika pochodzi.
- [x] **Etykiety dodatków idą za cennikiem.** Napis „+ 8 € pro Tag" przy
      polu wyboru był wpisany w kodzie strony; po zmianie ceny pokazywałby
      inną kwotę niż oferta. Teraz odświeża się razem z cennikiem.
- [x] **Po zapisie cennika kalkulator odświeża się sam**, bez
      przeładowania strony.
- [x] **Kopia awaryjna.** Gdyby w bazie nie było cennika albo serwer nie
      odpowiedział, kalkulator liczy po ostatnich znanych kwotach z kodu
      zamiast pokazywać zera (`source: built-in` w odpowiedzi).

#### Sprawdzone na prawdziwej bazie

| Co | Wynik |
| --- | --- |
| Zmiana Gold na 3.450 € w panelu | zakładka Angebot od razu 3.450 € / 115 € |
| Zmiana Bronze na 2.800 € i Führerschein na 12 € | 2.800 € / 93 €, etykieta „+ 12 € pro Tag", suma z dodatkiem 3.160 € |
| Zmiana cennika franczyzowego na Silber 2.500 € | `/franchise/calc` zwraca 3.100 € i 102,92 € przy prowizji 600 € |
| Zapis oferty franczyzowej po zmianie cennika | zapisana, kwoty policzone przez serwer |
| Cennik przywrócony do kwot z 28.10 | Angebot znowu 2.600 € / 87 € |

**Uwaga o odświeżaniu:** cennik wczytuje się przy logowaniu. Jeśli ktoś
zmieni go na innym komputerze w trakcie Twojej pracy, zobaczysz nowe kwoty
po przeładowaniu strony.

#### Stawka dzienna liczy się sama

Wpisujesz kwotę miesięczną, dzienna wylicza się jako **miesięczna ÷ 30,
zaokrąglona do pełnego euro**. Reguła odtwarza co do euro **wszystkie**
dotychczasowe cenniki:

| Cennik | Miesięczne | Wyliczone dzienne | W cenniku |
| --- | --- | --- | --- |
| 28.10.2026 | 2.600 / 2.900 / 3.300 / 3.600 | 87 / 97 / 110 / 120 | zgadza się |
| Angebot 01.10.2026 | 2.700 / 3.100 / 3.600 / 3.900 | 90 / 103 / 120 / 130 | zgadza się |
| Franczyza 18.05.2026 | 2.300 / 2.800 / 3.200 / 3.600 | 77 / 93 / 107 / 120 | zgadza się |

Wiążąca zostaje kwota miesięczna, więc dzienną można nadpisać ręcznie —
raz wpisana z ręki nie jest już poprawiana. Wczytanie cennika, w którym
dzienna odstaje od reguły, od razu traktuje ją jako ustawioną ręcznie.

#### Czego aplikacja pilnuje za administratora

- Cennik, który **obowiązuje w tej chwili**, nie daje się skasować.
- **Ostatni** cennik danego rodzaju nie daje się skasować — moduł nigdy
  nie zostaje bez cennika.
- Pusta lub zerowa kwota, brak nazwy, zły rodzaj → czytelny komunikat
  i zapis nie dochodzi do skutku. Cennik zapisuje się w całości albo wcale.
- Franczyzobiorca i konsultant nie widzą listy cenników ani cudzego
  rodzaju — ceny zakupu nie mogą trafić do przeglądarki partnera.

#### Błąd znaleziony przy sprawdzaniu

**Data obowiązywania cofała się o jeden dzień.** Sterownik bazy zamienia
kolumnę `DATE` na północ czasu lokalnego, a powrót do zapisu ISO przesuwa
dzień wstecz w każdej strefie na wschód od Londynu — cennik „od 28.10"
wracał jako „27.10". Data przychodzi teraz z bazy jako tekst.

#### Sprawdzone na prawdziwej bazie i w przeglądarce

Postgres postawiony na czas testu, migracje przeszły, serwer wstał.
Przejście: lista cenników, cennik „od 1 grudnia" założony z wyprzedzeniem
(dziś nadal obowiązuje stary, 5 grudnia już nowy), próba dwóch cenników
na ten sam dzień → odmowa, puste kwoty → odmowa, edycja, kasowanie
obowiązującego → odmowa, kasowanie przyszłego → wykonane, konsultant
próbujący zapisać cennik → odmowa. Panel przeklikany w prawdziwej
przeglądarce: cennik franczyzowy założony z poziomu formularza,
lista pokazuje go jako przyszły.

#### Czego ten krok nie obejmuje

**Oferty nadal liczą się z kwot wpisanych w kodzie.** To, co wpiszesz
w panelu, zacznie wpływać na oferty dopiero w kroku 8.3 — do tego czasu
nic nie przełączy się po cichu.

---

## Sesja 29.10.2026

### Commit `2803a82` — Angebot dostaje ofertę w układzie v9 (krok 7.5)

**Zgłoszenie PO:** „dalej jest problem z zakładką Angebot i generowanym PDF.
Dodaj nowy przycisk, gdzie generowany będzie PDF w nowej wersji."

- [x] **Układ strony 1 wyszedł do wspólnego szablonu.** `v9Strona1()`
      dostaje gotowe kwoty i nie wie, z której zakładki pochodzą; zbiera je
      `v9Dane()`. Obie zakładki mają te same nazwy pól, Franchise
      z przedrostkiem `fr-`, więc zbieracz jest jeden. Strony 2–4 są wspólne
      od kroku 7.4, więc Angebot dostał je od razu.
- [x] **Nowy przycisk „PDF speichern" w zakładce Angebot.** Obok zostaje
      stary „PDF / Drucken (alt)" — decyzja PO z 29.10: stary zostaje na czas
      prób. Gdy render na serwerze nie odpowie, nowy przycisk sam otwiera
      stare okno drukowania, więc konsultant nie zostaje z niczym.
- [x] **Pola klienta w Angebot** (Vorname, Nachname, Datum) — karta „Kunde"
      w panelu ustawień, data domyślnie dzisiejsza. Panel ustawień jest
      ukryty przy starym wydruku, więc nic się tam nie zmienia.
- [x] **Rabat na ofercie.** Zakładka Angebot ma rabat na taryfę bazową,
      którego moduł franczyzowy nie ma. Wiersz „Basistarif" pokazuje kwotę
      już po rabacie, więc rabat stoi osobnym wierszem nad nim — inaczej
      klient nie wiedziałby, skąd niższa kwota.
- [x] **Zamknięty błąd z 28.10:** nagłówek „Persönlicher Anteil nach allen
      Abzügen" był w Angebot wpisany na stałe i pokazywał się nawet przy
      zerowych odliczeniach. Teraz przełącza się na „Gesamt", tak jak
      we Franchise.

#### Dwa błędy znalezione przy sprawdzaniu

- **„einmalig" dublowało się.** Panel Angebot dopisuje do kwoty Express
  słowo „(einmalig)", a szablon stawia je sam — na ofercie stało dwa razy.
  Zbieracz danych zdejmuje je teraz z kwoty.
- **Spacja przed znakiem euro.** Po przejściu na odczyt kwot z panelu
  część kwot traciła spację nierozdzielającą i „300,00" mogło trafić do
  innego wiersza niż „€". Kwoty czytane są teraz bez zamiany tej spacji.

#### Sprawdzone renderem — sześć wariantów

| Wariant | Moduł | Stron | Poza kartkę |
| --- | --- | --- | --- |
| Silber + 600 €, bez dodatków | Franchise | 4 | — |
| Silber + 600 €, Führerschein, Pflegegrad 3 | Franchise | 4 | — |
| Platin + 1.200 €, komplet | Franchise | 4 | — |
| Bronze, bez dodatków i odliczeń | Angebot | 4 | — |
| Silber, rabat 200 €, Führerschein, Pflegegrad 3 | Angebot | 4 | — |
| Platin, rabat 300 €, 5 dodatków, 2 pacjentów, pełne odliczenia | Angebot | 4 | — |

Kontrola kwot (Angebot, wariant maksymalny): 3.600 − 300 rabatu = 3.300 €,
dodatki 37 €/dzień × 30 = 1.110 € → 4.410 €, odliczenia 990 + 800 + 294 +
333 = 2.417 € → **1.993 €/mies.** Zgadza się z panelem.

Oferta franczyzowa wychodzi z nowego szablonu z tą samą treścią co przed
przebudową — sprawdzone porównaniem tekstu plików. W żadnym z sześciu
plików nie ma ceny zakupu ani prowizji.

#### Czego ten krok nie obejmuje

Stary przycisk „PDF / Drucken (alt)" nadal drukuje żywy panel. Zniknie,
gdy PO potwierdzi, że nowy plik jest w porządku.

### Commit `85d80b7` — strony 2, 3 i 4 w układzie v9 (krok 7.4 zamknięty)

Cała oferta jest teraz w jednym stylu. Wcześniej strony opisowe miały własny
nagłówek z pomarańczowym paskiem i inną typografię, więc w jednym pliku PDF
widać było dwa układy.

- [x] **Nagłówek i stopka wspólne dla czterech stron.** `v9PageHead()`
      i `v9PageFoot()` — jedno miejsce, więc strony nie rozjadą się przy
      następnej zmianie. Stopka niesie `Kunde · data · tytuł strony`
      i numer, dokładnie jak na stronie 1.
- [x] **Strona 2 — Sprachpakete.** Dwie kolumny jak we wzorcu: po lewej
      „Seniorenbetreuung", nazwa pakietu i liczba słów, po prawej opis.
      Wybrany pakiet zachowuje podświetlenie z `49a954e`. Pod listą nota
      „Ihr gewähltes Sprachpaket … Die Kosten finden Sie auf Seite 1".
- [x] **Strona 3 — Allgemeine Produktbeschreibung.** Punkty
      z pomarańczowym znacznikiem, nagłówki sekcji 13,4 pt. Zdanie
      „Der genaue Umfang …" stoi jako nota „Auf Ihren Alltag abgestimmt."
      pod listą, a nie jako ostatni punkt — tak jak we wzorcu.
- [x] **Strona 4 — Zusatzleistungen.** Dodatki wliczone w tę konkretną
      ofertę dostają pomarańczową kropkę i podpis „Für Ihr Angebot
      ausgewählt"; pozostałe zostają jako sam opis. Gdy franczyzobiorca nie
      wybrał żadnego dodatku, wprowadzenie brzmi „Übersicht der möglichen
      Ergänzungen", żeby strona nie twierdziła nieprawdy.
- [x] **Blok kontaktowy „Wir sind für Sie da."** — granatowy, numer
      `0800 723 5 723` jako link `tel:08007235723`, sprawdzony w gotowym
      pliku. Pod nim logotypy ProvenExpert i Trustpilot, jak we wzorcu.

#### Pułapka: marginesy z ramy strony biły wprowadzenie

Rama strony zeruje marginesy akapitów (`.fr-pdf-page--v9 p`). Reguła
`.v9-intro` ma słabszą wagę, więc odstęp nad wprowadzeniem nie działał
i tekst kleił się do tytułu. Reguła jest teraz zagnieżdżona
(`.v9-doc .v9-intro`). Strony 1 nie ruszamy — jej proporcje są zmierzone
i zatwierdzone w kroku 7.3.

#### Sprawdzone renderem serwerowym, bez bazy i bez logowania

| Wariant | Stron | Font | Poza kartkę | Link `tel:` |
| --- | --- | --- | --- | --- |
| Silber + 600 €, bez dodatków | 4 | Alan Sans | — | ✅ strona 4 |
| Silber + 600 €, Führerschein, Pflegegrad 3 | 4 | Alan Sans | — | ✅ strona 4 |
| Platin + 1.200 €, 5 dodatków, 2 pacjentów, pełne odliczenia | 4 | Alan Sans | — | ✅ strona 4 |

Strona 1 bez zmian: krótka oferta zostaje w proporcjach wzorca, wariant
maksymalny schodzi do `v9-tightest`. Przeszukanie treści PDF-a: **nie ma
w nim ceny zakupu ani prowizji** w żadnym z trzech wariantów.

#### Czego ten krok nie obejmuje

Zakładka Angebot nadal drukuje żywy panel i ma własny wygląd — to krok 7.5.

---

## Sesja 28.10.2026

### Commit `d7ca26f` — wydruk Angebot przestał być formularzem

**Zgłoszenie PO:** „w wersji Angebot PDF jest cały czas błędny".

Odtworzony u siebie wydruk zakładki Angebot (Chromium, media `print`,
te same kroki co przycisk drukowania). Znalezione trzy rzeczy:

- [x] **Naprawione:** produkt i Pflegegrad drukowały się jako **rozwijane
      listy** z ramką i strzałką, a dodatki z **zaznaczonymi polami
      wyboru**. Klient dostawał zrzut panelu obsługi, nie ofertę. Teraz
      listy drukują się jako sam tekst, a pola wyboru znikają. Informacji
      nie ubywa: niezaznaczone dodatki i tak są chowane przed drukiem,
      więc każdy wydrukowany wiersz to pozycja wliczona w ofertę.
      Reguła zawężona do `#tab-angebot.print-active`.
- [ ] **Do zrobienia w 7.5:** nagłówek „Persönlicher Anteil nach allen
      Abzügen" jest w Angebot wpisany na stałe i pokazuje się nawet przy
      zerowych odliczeniach, gdy kwota równa się „Summe vor Abzügen".
      We Franchise przełącza się wtedy na „Gesamt".
- [ ] **Do zrobienia w 7.5:** Angebot nie ma pól klienta. Decyzja PO
      z 29.10: **dokładamy je, tak jak we Franchise.**

### Commit `49a954e` — wybrany pakiet językowy wyróżniony na stronie 2

**Uwaga PO:** wzorzec v9 wyróżnia pakiet, który oferta przedstawia; u nas
strona 2 była płaską listą czterech opisów.

- [x] Wybrany pakiet dostaje to samo podświetlenie co wybrana usługa na
      stronie 1 — kolor z alfą i cienki obrys, **nigdy `opacity`** —
      pogrubiony tytuł i podpis „Ihr gewähltes Paket".
- [x] Dopasowanie po nazwie produktu: tytuł karty w zakładce Angebot brzmi
      dokładnie tak samo jak etykieta pakietu w cenniku, więc nie powstaje
      drugie źródło prawdy.
- [x] `frPdfOpisy()` przyjmuje czwarty argument z nazwą wybranego pakietu.
      Strony 3 i 4 wołają ją bez niego, więc zostają bez zmian.

To **część** kroku 7.4. Reszta 7.4 — strony 2–4 w układzie v9 (nagłówek,
stopka, typografia) i blok kontaktowy „Wir sind für Sie da" — nadal czeka.

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

### Dlaczego Angebot wygląda inaczej — i jak to domykamy

Oba moduły robią PDF **zupełnie inaczej**:

| Moduł | Mechanizm |
| --- | --- |
| Franchise | składa osobny dokument w tle (`#fr-pdf-doc`) i wysyła do Chromium na serwerze (`POST /pdf/render`) — stąd przycisk „PDF speichern", zaznaczalny tekst i układ v9 |
| Angebot | drukuje **żywy panel** przez okno drukowania przeglądarki — na kartkę trafia to, co jest na ekranie, razem z kontrolkami |

Wyglądu v9 nie da się dokleić do drugiego mechanizmu. **Decyzja PO
z 29.10: Angebot przechodzi na ten sam mechanizm co Franchise.**

**Wspólny szablon.** Układ strony 1 wychodzi z modułu franczyzowego do
osobnej funkcji, która dostaje gotowe liczby i nie wie, z której zakładki
pochodzą. Franchise i Angebot tylko ją karmią. Inaczej powstają dwie kopie
tego samego układu i po pół roku różnią się w szczegółach, których nikt
nie pilnuje.

**Kolejność: 7.4 przed 7.5.** Strony 2–4 są dziś w starym układzie w obu
modułach. Gdyby najpierw zrobić Angebot, powstałyby dwa moduły z nową
stroną 1 i starymi stronami 2–4. Po domknięciu 7.4 przy Angebot wystarczy
podpiąć gotowy szablon.

| Kawałek | Zakres | Stan |
| --- | --- | --- |
| 7.1 | Decyzje: mechanizm PDF i zakres modułów | ✅ B + oba moduły |
| 7.2 | Silnik PDF na serwerze, styl wydzielony do pliku | ✅ `2147256` |
| 7.3 | Strona 1 w układzie v9, na danych z kalkulatora | ✅ `724297c` |
| 7.4 | Strony 2–4: opisy, podświetlenia, blok kontaktowy | ✅ `49a954e` + `85d80b7` |
| 7.5 | Angebot na wspólny szablon oferty | ✅ `2803a82` |
| 7.6 | Odtworzenie obu przykładów i porównanie ze wzorcami | ⬜ **następne** |

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
| Mechanizm PDF w Angebot | ✅ 29.10 — **ten sam co Franchise**, wspólny szablon |
| Kolejność kroków | ✅ 29.10 — **7.4 przed 7.5** |
| Oznaczanie wybranych dodatków na stronie 4 | ✅ 29.10 — **zostaje** |
| Logotypy opinii na stronie 4 | ✅ 29.10 — **zostają**, jak we wzorcu |
| `harness.cjs` w repozytorium | ✅ 29.10 — **tak**, `npm run check-pdf` |
| Adresat na ofercie Angebot | ✅ 29.10 — **pola klienta, tak jak we Franchise** (wzorzec ich nie ma, PO chce) |
| Stare drukowanie w Angebot | ✅ 29.10 — **zostaje na czas prób** obok nowego (zmiana decyzji z tego samego dnia) |
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
| Railway (test) | `angebot-calculator-betreuung24-production.up.railway.app` | ✅ commit `61a1616`, sprawdzone 29.10 |
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
- **Wydruk zakładki Angebot do podejrzenia:** Playwright otwiera
  `index.html`, usuwa `#login-overlay`, ustawia pola, woła `recalc()`,
  potem `print-active` + `beforePrint()` i `page.pdf()`. Uwaga: w zwykłej
  przeglądarce `beforePrint()` liczy wysokość, gdy zakładka jest jeszcze
  ukryta (`offsetHeight === 0`), więc jego automatyczne skalowanie nigdy
  się nie włącza — to martwy kod, znika razem z krokiem 7.5.
- **Test renderu bez bazy i bez logowania:** `npm run check-pdf`
  (`harness.cjs`, decyzja PO z 29.10 — skrypt leży w repozytorium).
  Mały serwer
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
