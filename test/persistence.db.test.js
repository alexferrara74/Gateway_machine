// Test di persistenza su un database MySQL reale. Disattivato di default.
//
// Attivazione (usare un database dedicato, vuoto o usa-e-getta, il cui nome termina in "_test"):
//   IT_DB_HOST=127.0.0.1 IT_DB_PORT=3306 IT_DB_USER=... IT_DB_PASSWORD=... IT_DB_NAME=service_test npm test
// Il test ricrea lo schema applicando la V1 di ../servizi_pilot_BE (unica fonte dello schema)
// e CANCELLA tutte le tabelle del database indicato: per questo il nome deve finire in "_test".
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import mysql from 'mysql2/promise';

const schemaFile = new URL(
    '../../servizi_pilot_BE/src/main/resources/db/migration/V1__schema_iniziale.sql',
    import.meta.url
);
const name = process.env.IT_DB_NAME || '';
const skip = !name
    ? 'impostare IT_DB_* per eseguire i test su database'
    : !name.endsWith('_test')
        ? 'IT_DB_NAME deve terminare con "_test": il test cancella le tabelle'
        : false;

let admin;
let persist;
let dbLocal;
let SyncPayloadDto;

async function count(table, where = '1=1') {
    const [[row]] = await admin.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`);
    return row.n;
}

function payload(overrides = {}) {
    return new SyncPayloadDto({
        clienti: [{ anagid: 12, anagclicod: 'C001', anagragsoc: 'Cliente uno', anagemailpec: 'a@b.it' }],
        prodotti: [{ articolo_id: 3, codice_articolo: 'P001', descrizione: 'Caffe', categoria_id: 4 }],
        attrezzature: [{ articolo_id: 5, codice_articolo: 'A001', descrizione: 'Macchina' }],
        accessori: [{ articolo_id: 6, codice_articolo: 'AC01', descrizione: 'Accessorio' }],
        classiSottoclassi: [{ categoria_id: 4, classe_codice: '070', sottoclasse_codice: '050', descrizione: 'PRIMA COLAZIONE', tipo: 0 }],
        prodottiFatturati: [{
            anno_erp: 2026, id_riga_erp: 100, id_testata_erp: 1, data_documento: '2026-10-01',
            cliente_id: 12, codice_cliente: 'C001', articolo_id: 3, codice_articolo: 'P001',
            descrizione: 'Caffe', categoria_id: 4, quantita: 5
        }],
        ...overrides
    });
}

before(async () => {
    if (skip) return;
    Object.assign(process.env, {
        DB_NUOVO_HOST: process.env.IT_DB_HOST || '127.0.0.1',
        DB_NUOVO_PORT: process.env.IT_DB_PORT || '3306',
        DB_NUOVO_USER: process.env.IT_DB_USER || 'root',
        DB_NUOVO_PASSWORD: process.env.IT_DB_PASSWORD ?? '',
        DB_NUOVO_NAME: name
    });
    admin = await mysql.createConnection({
        host: process.env.DB_NUOVO_HOST,
        port: Number(process.env.DB_NUOVO_PORT),
        user: process.env.DB_NUOVO_USER,
        password: process.env.DB_NUOVO_PASSWORD,
        database: name,
        multipleStatements: true
    });
    const [tables] = await admin.query('SHOW TABLES');
    await admin.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const row of tables) await admin.query(`DROP TABLE \`${Object.values(row)[0]}\``);
    await admin.query('SET FOREIGN_KEY_CHECKS = 1');
    await admin.query(await readFile(schemaFile, 'utf8'));

    ({ storicizzaPayloadCompleto: persist } = await import('../src/services/syncPersistenceService.js'));
    ({ default: dbLocal } = await import('../src/config/dbLocal.js'));
    ({ default: SyncPayloadDto } = await import('../src/dtos/syncPayloadDto.js'));
});

after(async () => {
    await dbLocal?.end();
    await admin?.end();
});

test('stores customers, catalog and invoiced products', { skip }, async () => {
    await persist(payload());

    assert.equal(await count('local_clienti'), 1);
    assert.equal(await count('local_prodotti'), 3);
    assert.equal(await count('local_prodotti', 'is_attrezzatura = 1'), 1);
    assert.equal(await count('local_prodotti', 'is_accessorio = 1'), 1);
    assert.equal(await count('local_attrezzature'), 1);
    assert.equal(await count('local_classi_sottoclassi'), 1);
    assert.equal(await count('storia_prodotti', "origine = 'ERP'"), 1);
});

test('is idempotent: a second run does not duplicate rows', { skip }, async () => {
    const counts = async () => [await count('local_clienti'), await count('local_prodotti'),
        await count('local_attrezzature'), await count('storia_prodotti')];
    const initial = await counts();

    await persist(payload());

    assert.deepEqual(await counts(), initial);
});

test('updates an invoiced row when the ERP changes it', { skip }, async () => {
    const changed = payload();
    changed.prodottiFatturatiPerCliente[0].prodotti[0].quantita = 9;

    await persist(changed);

    const [[row]] = await admin.query('SELECT quantita FROM storia_prodotti WHERE erp_riga_id = 100');
    assert.equal(Number(row.quantita), 9);
    assert.equal(await count('storia_prodotti'), 1);
});

test('never removes manual rows or equipment with a serial number', { skip }, async () => {
    await admin.query(`INSERT INTO local_prodotti (articolo_id, codice, descrizione, origine)
                       VALUES (900, 'MAN1', 'Inserito a mano', 'MANUALE')`);
    await admin.query(`INSERT INTO local_prodotti (articolo_id, codice, descrizione, is_attrezzatura, origine)
                       VALUES (901, 'OLD1', 'Vecchia macchina ERP', 1, 'ERP')`);
    await admin.query(`INSERT INTO local_attrezzature (articolo_id, matricola, descrizione, origine)
                       VALUES (901, 'SN-123', 'Curata dall''operatore', 'ERP')`);
    await admin.query(`INSERT INTO local_prodotti (articolo_id, codice, descrizione, origine)
                       VALUES (902, 'OLD2', 'Prodotto sparito dall''ERP', 'ERP')`);
    await admin.query(`INSERT INTO storia_prodotti (cliente_id, codice_articolo, quantita, origine)
                       VALUES (12, 'MAN1', 1, 'MANUALE')`);

    await persist(payload());

    assert.equal(await count('local_prodotti', 'articolo_id = 900'), 1, 'riga manuale conservata');
    assert.equal(await count('local_attrezzature', "matricola = 'SN-123'"), 1, 'attrezzatura con matricola conservata');
    assert.equal(await count('local_prodotti', 'articolo_id = 901'), 1, 'prodotto collegato a un\'attrezzatura conservato');
    assert.equal(await count('local_prodotti', 'articolo_id = 902'), 0, 'prodotto ERP sparito rimosso');
    assert.equal(await count('storia_prodotti', "origine = 'MANUALE'"), 1, 'storico manuale conservato');
});

test('rolls back everything when an invoiced row is invalid', { skip }, async () => {
    const snapshot = [await count('local_clienti'), await count('local_prodotti'), await count('storia_prodotti')];
    const broken = payload({
        clienti: [{ anagid: 99, anagclicod: 'C099', anagragsoc: 'Non deve comparire' }]
    });
    broken.prodottiFatturatiPerCliente[0].prodotti[0].idRigaErp = null;

    await assert.rejects(() => persist(broken), /storicizzazione annullata/);

    assert.deepEqual(
        [await count('local_clienti'), await count('local_prodotti'), await count('storia_prodotti')],
        snapshot
    );
    assert.equal(await count('local_clienti', 'id = 99'), 0);
});
