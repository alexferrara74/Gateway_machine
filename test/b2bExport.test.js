import assert from 'node:assert/strict';
import { after, test } from 'node:test';

const { default: app } = await import('../src/app.js');
const { config } = await import('../src/config/config.js');
const { buildProdottiCsv } = await import('../src/services/b2bExportService.js');

const server = app.listen(0);
const baseUrl = await new Promise(resolve => {
    server.once('listening', () => resolve(`http://127.0.0.1:${server.address().port}`));
});

after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
}));

const riga = (extra = {}) => ({
    codice: 'a1001', descrizione: 'Dispenser cereali', categoria: 'Attrezzature', um: 'NR',
    prezzo: 7.5, iva: 22, giacenza: '12', bloccato: 0, ...extra
});

test('scrive il tracciato: intestazione, prezzo con il punto, codice maiuscolo, um minuscola', () => {
    const { csv, esportate, escluse } = buildProdottiCsv([riga(), riga({ codice: 'B2', prezzo: 0.185, iva: 10.0, um: '', giacenza: -3 })]);
    assert.deepEqual(csv.split('\n'), [
        'codice;descrizione;categoria;um;prezzo;iva;giacenza;attivo',
        'A1001;Dispenser cereali;Attrezzature;nr;7.50;22;12;1',
        'B2;Dispenser cereali;Attrezzature;pz;0.185;10;0;1',
        ''
    ]);
    assert.equal(esportate, 2);
    assert.equal(escluse.length, 0);
});

test('mette tra apici i testi con ; o " e normalizza gli spazi', () => {
    const { csv } = buildProdottiCsv([riga({ descrizione: '  Caffè; "extra"\n   forte ' })]);
    assert.equal(csv.split('\n')[1].split(';')[1], '"Caffè');
    assert.ok(csv.includes('"Caffè; ""extra"" forte"'));
});

test('articoli bloccati nell\'ERP escono con attivo = 0', () => {
    const { csv } = buildProdottiCsv([riga({ bloccato: 1 })]);
    assert.ok(csv.split('\n')[1].endsWith(';0'));
});

test('esclude e segnala gli articoli che il sito rifiuterebbe', () => {
    const { esportate, escluse } = buildProdottiCsv([
        riga({ codice: 'OK1' }),
        riga({ codice: 'NOPRZ', prezzo: null }),
        riga({ codice: 'PRZ0', prezzo: 0 }),
        riga({ codice: 'NOIVA', iva: null }),
        riga({ codice: 'IVA55', iva: 5.5 }),
        riga({ codice: 'ok1' }),
        riga({ codice: 'BAD CODE' }),
        riga({ codice: 'NODESC', descrizione: '   ' })
    ]);
    assert.equal(esportate, 1);
    assert.deepEqual(escluse.map(item => item.motivo), [
        'prezzo mancante nel listino', 'prezzo mancante nel listino', 'IVA mancante o non intera',
        'IVA mancante o non intera', 'codice duplicato', 'codice non valido', 'descrizione vuota'
    ]);
});

test('GET /api/export/prodotti risponde 503 se categorie e listino non sono configurati', async () => {
    const previous = config.b2bExport;
    config.b2bExport = { categoryIds: [], priceListId: 0 };
    try {
        const response = await fetch(`${baseUrl}/api/export/prodotti`);
        assert.equal(response.status, 503);
        assert.match((await response.json()).message, /EXPORT_B2B_CATEGORIE_IDS/);
    } finally {
        config.b2bExport = previous;
    }
});

test('GET /api/export/prodotti richiede il token quando è configurato', async () => {
    const previous = config.syncApiToken;
    config.syncApiToken = 'segreto';
    try {
        assert.equal((await fetch(`${baseUrl}/api/export/prodotti`)).status, 401);
        assert.equal((await fetch(`${baseUrl}/api/export/prodotti`, { headers: { Authorization: 'Bearer sbagliato' } })).status, 401);
    } finally {
        config.syncApiToken = previous;
    }
});
