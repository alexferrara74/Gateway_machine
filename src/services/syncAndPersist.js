import { eseguiSincronizzazione } from './rentalService.js';
import { storicizzaPayloadCompleto } from './syncPersistenceService.js';

let syncInProgress = false;

async function sincronizzaEPersisti(mesiStorico) {
    if (syncInProgress) {
        const error = new Error('È già in corso una sincronizzazione.');
        error.code = 'SYNC_IN_PROGRESS';
        throw error;
    }

    syncInProgress = true;
    try {
        const result = await eseguiSincronizzazione(mesiStorico);
        await storicizzaPayloadCompleto(result.payload);
        return { statistiche: result.statistiche };
    } finally {
        syncInProgress = false;
    }
}

export { sincronizzaEPersisti };
