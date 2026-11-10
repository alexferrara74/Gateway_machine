import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const { config } = await import('../src/config/config.js');
const { consegnaViaSftp, generaEConsegnaProdottiB2B, verificaImpronta } = await import('../src/services/b2bExportJob.js');

const sftp = { host: 'sftp.example', port: 22, username: 'u', password: 'p', privateKeyPath: '', remoteDir: 'sana-private/data/import/', hostFingerprint: 'x' };

function fakeClient({ esiste = false, failOn } = {}) {
    const calls = [];
    const step = (name, fn = () => undefined) => async (...args) => {
        calls.push([name, ...args.map(a => (Buffer.isBuffer(a) ? `buffer(${a.length})` : typeof a === 'object' ? 'opzioni' : a))]);
        if (failOn === name) throw new Error(`${name} fallito`);
        return fn();
    };
    return {
        calls,
        connect: step('connect'),
        put: step('put'),
        exists: step('exists', () => esiste),
        delete: step('delete'),
        rename: step('rename'),
        end: step('end')
    };
}

async function withB2bConfig(overrides, callback) {
    const previous = config.b2bExport;
    config.b2bExport = { ...previous, ...overrides };
    try {
        await callback();
    } finally {
        config.b2bExport = previous;
    }
}

test('SFTP: carica come .part e poi rinomina, poi chiude la connessione', async () => {
    const client = fakeClient();
    await consegnaViaSftp('codice;x\n', sftp, () => client);
    assert.deepEqual(client.calls.map(c => c[0]), ['connect', 'put', 'exists', 'rename', 'end']);
    assert.equal(client.calls[1][2], 'sana-private/data/import/prodotti.csv.part');
    assert.deepEqual(client.calls[3].slice(1), ['sana-private/data/import/prodotti.csv.part', 'sana-private/data/import/prodotti.csv']);
});

test('SFTP: un prodotti.csv non ancora elaborato viene sostituito', async () => {
    const client = fakeClient({ esiste: true });
    await consegnaViaSftp('x', sftp, () => client);
    assert.deepEqual(client.calls.map(c => c[0]), ['connect', 'put', 'exists', 'delete', 'rename', 'end']);
    assert.equal(client.calls[3][1], 'sana-private/data/import/prodotti.csv');
});

test('SFTP: se qualcosa fallisce la connessione viene chiusa e l\'errore arriva al chiamante', async () => {
    for (const failOn of ['connect', 'put', 'rename']) {
        const client = fakeClient({ failOn });
        await assert.rejects(consegnaViaSftp('x', sftp, () => client), new RegExp(`${failOn} fallito`));
        assert.equal(client.calls.at(-1)[0], 'end');
    }
});

test('verifica dell\'impronta: accetta solo il server atteso (formato SHA256 di ssh-keygen)', () => {
    const key = Buffer.from('chiave-pubblica-del-server');
    const impronta = createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
    assert.equal(verificaImpronta(`SHA256:${impronta}`)(key), true);
    assert.equal(verificaImpronta(impronta)(key), true);
    const originalError = console.error;
    console.error = () => {};
    try {
        assert.equal(verificaImpronta('SHA256:altra')(key), false);
    } finally {
        console.error = originalError;
    }
});

test('job: scrive il file nella cartella locale senza lasciare il .part e riporta i numeri', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'b2b-'));
    try {
        await withB2bConfig({ outputDir: dir, sftp: { ...sftp, host: '' } }, async () => {
            const esporta = async () => ({ csv: 'codice;descrizione\nA1;Uno\n', esportate: 1, escluse: [{ codice: 'X', motivo: 'prezzo mancante nel listino' }] });
            const warn = console.warn;
            console.warn = () => {};
            try {
                const result = await generaEConsegnaProdottiB2B({ esporta });
                assert.deepEqual(result, { esportate: 1, escluse: 1, destinazioni: ['cartella locale'] });
            } finally {
                console.warn = warn;
            }
        });
        assert.deepEqual(await readdir(dir), ['prodotti.csv']);
        assert.equal(await readFile(path.join(dir, 'prodotti.csv'), 'utf8'), 'codice;descrizione\nA1;Uno\n');
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test('job: con SFTP configurato consegna lo stesso contenuto', async () => {
    await withB2bConfig({ outputDir: '', sftp }, async () => {
        let ricevuto;
        const result = await generaEConsegnaProdottiB2B({
            esporta: async () => ({ csv: 'CSV', esportate: 3, escluse: [] }),
            consegna: async (csv, opzioni) => { ricevuto = [csv, opzioni.host]; }
        });
        assert.deepEqual(ricevuto, ['CSV', 'sftp.example']);
        assert.deepEqual(result.destinazioni, ['SFTP']);
    });
});

test('job: senza destinazioni configurate non esporta nulla; se l\'export fallisce non consegna', async () => {
    await withB2bConfig({ outputDir: '', sftp: { ...sftp, host: '' } }, async () => {
        let chiamato = false;
        await assert.rejects(
            generaEConsegnaProdottiB2B({ esporta: async () => { chiamato = true; } }),
            error => error.code === 'EXPORT_CONFIG'
        );
        assert.equal(chiamato, false);
    });
    await withB2bConfig({ outputDir: '', sftp }, async () => {
        let consegnato = false;
        await assert.rejects(
            generaEConsegnaProdottiB2B({ esporta: async () => { throw new Error('ERP non raggiungibile'); }, consegna: async () => { consegnato = true; } }),
            /ERP non raggiungibile/
        );
        assert.equal(consegnato, false);
    });
});

test('config: con il cron dell\'export attivo la configurazione incompleta blocca l\'avvio', async () => {
    const base = {
        DB_HOST: '127.0.0.1', DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'n', DB_NUOVO_HOST: '127.0.0.1',
        DB_NUOVO_USER: 'u', DB_NUOVO_PASSWORD: 'p', DB_NUOVO_NAME: 's', CRON_ENABLED: 'false',
        EXPORT_B2B_CRON_ENABLED: 'true', EXPORT_B2B_CATEGORIE_IDS: '1', EXPORT_B2B_LISTINO_ID: '3'
    };
    const run = async (extra, tag) => {
        const previous = {};
        for (const [k, v] of Object.entries({ ...base, ...extra })) { previous[k] = process.env[k]; process.env[k] = v; }
        try {
            const { validateConfig } = await import(`../src/config/config.js?export-${tag}`);
            return validateConfig;
        } finally {
            for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
        }
    };
    assert.throws(await run({}, 'nodest'), /dove consegnare/);
    assert.doesNotThrow(await run({ EXPORT_B2B_OUTPUT_DIR: 'C:/export' }, 'locale'));
    assert.throws(await run({ EXPORT_B2B_SFTP_HOST: 'h', EXPORT_B2B_SFTP_USER: 'u' }, 'sftp'), /REMOTE_DIR.*PASSWORD.*FINGERPRINT/);
    assert.doesNotThrow(await run({
        EXPORT_B2B_SFTP_HOST: 'h', EXPORT_B2B_SFTP_USER: 'u', EXPORT_B2B_SFTP_PASSWORD: 'p',
        EXPORT_B2B_SFTP_REMOTE_DIR: 'sana-private/data/import', EXPORT_B2B_SFTP_HOST_FINGERPRINT: 'SHA256:abc'
    }, 'sftp-ok'));
});
