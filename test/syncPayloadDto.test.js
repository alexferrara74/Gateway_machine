import assert from 'node:assert/strict';
import { test } from 'node:test';
import SyncPayloadDto from '../src/dtos/syncPayloadDto.js';

test('groups invoiced products by ERP customer code and maps catalog data separately', () => {
    const payload = new SyncPayloadDto({
        clienti: [{
            anagid: 12,
            anagclicod: 'C001',
            anagragsoc: 'Cliente di test'
        }],
        prodotti: [{
            articolo_id: 3,
            codice_articolo: 'P001',
            descrizione: 'Prodotto',
            categoria_id: 4
        }],
        attrezzature: [{
            articolo_id: 5,
            codice_articolo: 'A001',
            descrizione: 'Attrezzatura'
        }],
        classiSottoclassi: [{
            categoria_id: 4,
            classe_codice: '160',
            sottoclasse_codice: '002',
            descrizione: 'MACCHINE DA CAFFE',
            tipo: 1
        }],
        prodottiFatturati: [
            {
                anno_erp: 2026,
                id_riga_erp: 15,
                id_testata_erp: 31,
                numero_documento: 8,
                tipo_documento: 'FAT',
                data_documento: '2026-10-27',
                cliente_id: 12,
                codice_cliente: 'C001',
                ragione_sociale: 'Cliente di test',
                articolo_id: 3,
                codice_articolo: 'P001',
                descrizione: 'Prodotto',
                categoria_id: 4,
                quantita: 0
            },
            {
                anno_erp: 2026,
                id_riga_erp: 16,
                id_testata_erp: 32,
                numero_documento: 9,
                tipo_documento: 'FAT',
                data_documento: '2026-10-28',
                cliente_id: 12,
                codice_cliente: 'C001',
                ragione_sociale: 'Cliente di test',
                articolo_id: 3,
                codice_articolo: 'P001',
                descrizione: 'Prodotto',
                categoria_id: 4,
                quantita: 2
            },
            {
                anno_erp: 2026,
                id_riga_erp: 17,
                id_testata_erp: 33,
                numero_documento: 10,
                tipo_documento: 'FAT',
                data_documento: '2026-10-29',
                cliente_id: 13,
                codice_cliente: 'C002',
                ragione_sociale: 'Secondo cliente',
                articolo_id: 3,
                codice_articolo: 'P001',
                descrizione: 'Prodotto',
                categoria_id: 4,
                quantita: 1
            }
        ]
    });

    assert.equal(payload.clienti[0].codice, 'C001');
    assert.equal(payload.prodotti[0].id, 3);
    assert.equal(payload.attrezzature[0].id, 5);
    assert.deepEqual(payload.classiSottoclassi, [{
        id: 4,
        classeCodice: '160',
        sottoclasseCodice: '002',
        descrizione: 'MACCHINE DA CAFFE',
        tipo: 1
    }]);
    assert.equal(payload.prodottiFatturatiPerCliente.length, 2);
    assert.equal(payload.prodottiFatturatiPerCliente[0].codiceCliente, 'C001');
    assert.equal(payload.prodottiFatturatiPerCliente[0].prodotti.length, 2);
    assert.equal(payload.prodottiFatturatiPerCliente[0].prodotti[0].quantita, 0);
    assert.equal(payload.prodottiFatturatiPerCliente[1].codiceCliente, 'C002');
    assert.deepEqual(payload.accessori, []);
});

test('rejects invoice rows without an ERP customer code', () => {
    assert.throws(
        () => new SyncPayloadDto({
            prodottiFatturati: [{ id_riga_erp: 15, codice_cliente: '' }]
        }),
        /non ha un codice cliente/
    );
});

test('preserves invoice description rows that have no ERP article', () => {
    const payload = new SyncPayloadDto({
        prodottiFatturati: [{
            anno_erp: 2026,
            id_riga_erp: 5205,
            id_testata_erp: 1003,
            numero_documento: 19,
            tipo_documento: 'Fattura buoni pasto',
            data_documento: '2026-03-05',
            cliente_id: 4091,
            codice_cliente: '0000000021',
            ragione_sociale: 'Cliente di test',
            articolo_id: null,
            codice_articolo: null,
            descrizione: 'CENA BORGO MAGNO - n.coperti: 16',
            categoria_id: null,
            quantita: 1
        }]
    });

    const [customer] = payload.prodottiFatturatiPerCliente;
    assert.equal(customer.codiceCliente, '0000000021');
    assert.equal(customer.prodotti[0].articoloId, null);
    assert.equal(customer.prodotti[0].codiceArticolo, null);
    assert.equal(customer.prodotti[0].categoriaId, null);
    assert.equal(customer.prodotti[0].descrizione, 'CENA BORGO MAGNO - n.coperti: 16');
});
