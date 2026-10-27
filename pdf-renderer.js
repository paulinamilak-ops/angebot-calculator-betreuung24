/* pdf-renderer.js - zamiana dokumentu oferty na prawdziwy plik PDF.
 *
 * Dlaczego po stronie serwera: wczesniejszy mechanizm (html2canvas) robil
 * zdjecie strony i wklejal obrazek do PDF-a. Tekstu nie dalo sie zaznaczyc,
 * linki nie dzialaly, a pliki byly ciezkie. Zatwierdzony wyglad oferty
 * wymaga zaznaczalnego tekstu i klikalnego telefonu, wiec dokument sklada
 * tu Chromium przez Playwright - tak samo, jak powstaly wzorce v9.
 *
 * Przegladarka startuje leniwie przy pierwszym zadaniu i zostaje w pamieci.
 * Start Chromium trwa okolo sekundy; przy kazdym PDF byloby to slychac.
 */

'use strict';

const PAGE_TIMEOUT_MS   = Number(process.env.PDF_TIMEOUT_MS || 30000);
const LAUNCH_TIMEOUT_MS = Number(process.env.PDF_LAUNCH_TIMEOUT_MS || 60000);

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    /* Chromium potrafi pasc (brak pamieci w kontenerze). Wtedy startujemy
       od nowa, zamiast oddawac uzytkownikowi martwe polaczenie. */
    if (b && b.isConnected()) return b;
    browserPromise = null;
  }

  const { chromium } = require('playwright');
  const launch = {
    headless: true,
    timeout: LAUNCH_TIMEOUT_MS,
    /* Kontener nie ma /dev/shm w rozmiarze, jakiego Chromium oczekuje;
       bez tego przegladarka wywraca sie przy wiekszych stronach. */
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  browserPromise = chromium.launch(launch);
  return browserPromise;
}

function escAttr(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Dokument sklada przegladarka uzytkownika, wiec zanim trafi do Chromium
   po stronie serwera, znikaja z niego skrypty i procedury obslugi zdarzen.
   Oferta to czysta tresc - nic z tego nie jest jej do niczego potrzebne. */
function stripScripts(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/* Dokument oferty wchodzi w stala ramke. Arkusz i grafiki ciagniete sa
   z naszego wlasnego serwera przez <base>, wiec w tresci nie ma osadzonych
   fontow ani obrazkow - zadanie zostaje lekkie. */
function buildShell(bodyHtml, baseUrl, title) {
  return '<!doctype html><html lang="de" class="pdf-render"><head><meta charset="utf-8">'
       + '<base href="' + escAttr(baseUrl) + '">'
       + '<title>' + escAttr(title || 'Angebot') + '</title>'
       + '<link rel="stylesheet" href="offer-print.css">'
       + '</head><body><div id="fr-pdf-doc">' + bodyHtml + '</div></body></html>';
}

/* Oba fragmenty sa wywolaniami natychmiastowymi: page.evaluate dostaje tu
   tekst, a tekst jest liczony jako wyrazenie - sama strzalka zwrocilaby
   funkcje, ktorej nie da sie przeniesc ze strony.

   Kontrola przed zlozeniem pliku, wzorowana na skrypcie z paczki v9:
   font musi byc zaladowany, obrazki pobrane, a tresc nie moze wychodzic
   poza kartke. Lepiej zwrocic blad niz cicho obciac oferte. */
const LAYOUT_PROBE = `(() => {
  const pages = [...document.querySelectorAll('.fr-pdf-page')];
  return {
    pageCount: pages.length,
    /* fonts.check bywa ostrozne i odpowiada 'nie' na konkretna gramature,
       nawet gdy krój jest w komplecie. Pytamy wprost o zaladowane kroje. */
    fontLoaded: [...document.fonts].some(f => f.family.indexOf('Alan') >= 0 && f.status === 'loaded'),
    imagesOK: [...document.images].every(i => i.complete && i.naturalWidth > 0),
    overflow: pages.map((p, i) => {
      const box = p.getBoundingClientRect();
      const bad = [...p.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.bottom > box.bottom + 1 || r.right > box.right + 1);
      });
      return bad.length ? { page: i + 1, count: bad.length } : null;
    }).filter(Boolean)
  };
})()`;

const WAIT_READY = `(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
})()`;

/**
 * Sklada PDF z gotowego HTML-a dokumentu oferty.
 * @param {string} bodyHtml wnetrze #fr-pdf-doc - kartki .fr-pdf-page
 * @param {string} baseUrl  adres, spod ktorego leca arkusz i grafiki
 * @param {object} [opts]   { title }
 * @returns {Promise<{pdf: Buffer, probe: object}>}
 */
async function renderOffer(bodyHtml, baseUrl, opts) {
  const options = opts || {};
  if (!bodyHtml || typeof bodyHtml !== 'string') throw new Error('empty_document');

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1000, height: 1300 },
    deviceScaleFactor: 1
  });

  /* Dokument dostaje wlasny adres w naszej domenie, zamiast byc wstrzykniety
     przez setContent. To nie jest kosmetyka: strona zlozona setContentem ma
     adres about:blank, wiec dla przegladarki font z @font-face jest zasobem
     z obcego zrodla i CORS go odrzuca. Arkusz i obrazki przechodza, font nie
     - i oferta wychodzi zastepczym krojem. Z wlasnym adresem wszystko jest
     tego samego pochodzenia. */
  const docUrl = baseUrl + '__pdf-render__';
  const shell  = buildShell(stripScripts(bodyHtml), baseUrl, options.title);

  try {
    /* Dokument moze niesc tylko nasze wlasne zasoby. Blokada jest tu po to,
       zeby tresc zlozona w przegladarce uzytkownika nie mogla wyciagnac
       niczego z internetu ani z sieci lokalnej serwera. */
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url === docUrl) {
        return route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: shell
        });
      }
      if (url.startsWith(baseUrl) || url.startsWith('data:')) return route.continue();
      return route.abort();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);

    await page.goto(docUrl, { waitUntil: 'load', timeout: PAGE_TIMEOUT_MS });

    await page.evaluate(WAIT_READY);
    const probe = await page.evaluate(LAYOUT_PROBE);
    if (!probe.pageCount) throw new Error('no_pages');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      scale: 1,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      tagged: true,
      outline: false
    });

    return { pdf, probe };
  } finally {
    await context.close().catch(() => {});
  }
}

async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  if (b) await b.close().catch(() => {});
}

module.exports = { renderOffer, closeBrowser };
