/* harness.cjs - render oferty bez bazy i bez logowania.
 *
 * Uruchomienie:  node harness.cjs .           (albo: npm run check-pdf)
 * Wynik:         ./pdf-test/<wariant>.pdf  + wiersz kontrolny na konsoli.
 *
 * Playwright dziala w kontenerze Claude, nie w maszynie na komputerze PO -
 * pobieranie przegladarek jest tam zablokowane. Skrypt lezy w repozytorium
 * po to, zeby nie trzeba go bylo pisac od nowa w kazdej sesji.
 *
 * Co sprawdza: cztery strony, zaladowany font Alan Sans, pobrane obrazki,
 * nic poza kartka A4 i to, ktory stopien zageszczenia zlapala strona 1.
   Maly serwer statyczny na plikach repozytorium, Playwright otwiera
   index.html, ustawia pola fr-*, wola frRecalc() i frBuildPdfDoc(),
   a gotowy #fr-pdf-doc.innerHTML idzie do pdf-renderer.renderOffer(). */
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.argv[2];
const OUT  = process.argv[3] || path.join(ROOT, 'pdf-test');
const renderer = require(path.join(ROOT, 'pdf-renderer.js'));

const TYPES = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml',
  '.ttf':'font/ttf','.ico':'image/x-icon','.jpg':'image/jpeg'};

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404); return res.end('nope'); }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'});
    res.end(data);
  });
});

const WARIANTY = [
  { nazwa: 'silber-prosty', paket: 'silber', provision: 600, persons: 1,
    addons: [], abzuege: false },
  { nazwa: 'silber-abzuege', paket: 'silber', provision: 600, persons: 1,
    addons: ['fuehrerschein'], abzuege: true, pg1: 3 },
  { nazwa: 'platin-max', paket: 'platin', provision: 1200, persons: 2,
    addons: ['express','fuehrerschein','zweitepersonhh','zweitepersonzb','sonderbetreuung'],
    abzuege: true, pg1: 5, pg2: 4, verhind: true, steuer: true }
];

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let bledy = 0;

  for (const w of WARIANTY) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const konsola = [];
    page.on('pageerror', e => konsola.push('pageerror: ' + e.message));
    await page.goto(base + 'index.html', { waitUntil: 'load' });
    await page.evaluate(`(() => {
      const ov = document.getElementById('login-overlay');
      if (ov) ov.remove();
      document.body.classList.remove('locked');
    })()`);

    const body = await page.evaluate(`(() => {
      const W = ${JSON.stringify(w)};
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
      const check = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
      set('fr-vorname', 'Anna'); set('fr-nachname', 'Müller'); set('fr-datum', '2026-10-29');
      set('fr-produkt-pick', W.paket);
      set('fr-provision', W.provision);
      set('fr-patient-count', W.persons);
      ['express','fuehrerschein','zweitepersonhh','zweitepersonzb','sonderbetreuung']
        .forEach(k => check('fr-addon-' + k, W.addons.indexOf(k) >= 0));
      check('fr-abzuege-toggle', W.abzuege);
      check('fr-verhinderung', !!W.verhind);
      check('fr-steuer', !!W.steuer);
      if (W.pg1 != null) set('fr-pflegegrad1', W.pg1);
      if (W.pg2 != null) set('fr-pflegegrad2', W.pg2);
      frRecalc();
      const doc = frBuildPdfDoc();
      return doc ? doc.innerHTML : '';
    })()`);

    if (!body) { console.log('✗', w.nazwa, 'pusty dokument', konsola); bledy++; await page.close(); continue; }

    const { pdf, probe } = await renderer.renderOffer(body, base, { title: 'Angebot' });
    fs.writeFileSync(path.join(OUT, w.nazwa + '.pdf'), pdf);

    const klasa = await page.evaluate(`document.querySelector('#fr-pdf-doc .fr-pdf-page--offer').className`);
    const ok = probe.pageCount === 4 && probe.fontLoaded && probe.imagesOK && !probe.overflow.length;
    if (!ok) bledy++;
    console.log((ok ? '✓' : '✗'), w.nazwa,
      '| stron:', probe.pageCount,
      '| font:', probe.fontLoaded,
      '| obrazki:', probe.imagesOK,
      '| poza kartka:', JSON.stringify(probe.overflow),
      '| strona1:', klasa.replace('fr-pdf-page fr-pdf-page--v9 fr-pdf-page--offer', '').trim() || 'proporcje wzorca');
    if (konsola.length) console.log('   konsola:', konsola);
    await page.close();
  }

  await browser.close();
  await renderer.closeBrowser();
  server.close();
  process.exit(bledy ? 1 : 0);
})();
