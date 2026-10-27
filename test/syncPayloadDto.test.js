import assert from 'node:assert/strict';
import { test } from 'node:test';
import SyncPayloadDto from '../src/dtos/syncPayloadDto.js';

test('maps DDT source keys and preserves zero quantities', () => {
    const payload = new SyncPayloadDto([{
        anno_erp: 2026,
        id_riga_erp: 15,
        id_testata_erp: 31,
        numero_documento: 8,
        tipo_documento: 'NOL',
        sezionale: 'A',
        data_doc: '2026-10-27',
        cliente_id: 12,
        articolo_id: 3,
        matricola: 'M-1',
        quantita: 0
    }]);

    assert.deepEqual(payload.noleggi[0], {
        annoErp: 2026,
        idRigaErp: 15,
        idTestataErp: 31,
        numeroDocumento: 8,
        tipoDocumento: 'NOL',
        sezionale: 'A',
        dataInizio: '2026-10-27',
        dataFine: null,
        clienteId: 12,
        articoloId: 3,
        matricola: 'M-1',
        quantita: 0
    });
});
