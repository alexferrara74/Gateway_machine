import { Router } from 'express';
import { config } from '../config/config.js';
import { sincronizzaEPersisti } from '../services/syncAndPersist.js';
import { isSyncAuthorized } from '../utils/syncAuth.js';

const router = Router();

router.post('/riarmo-sync', async (req, res) => {
    if (!isSyncAuthorized(req.get('authorization'), config.syncTriggerToken)) {
        return res.status(401).json({
            status: 'error',
            message: 'Token di sincronizzazione non valido.'
        });
    }

    const mesi = req.body?.mesi ?? config.mesiStorico;
    if (!Number.isInteger(mesi) || mesi < 1 || mesi > 120) {
        return res.status(400).json({
            status: 'error',
            message: 'Il campo mesi deve essere un intero tra 1 e 120.'
        });
    }

    try {
        const result = await sincronizzaEPersisti(mesi);
        return res.status(200).json({
            status: 'success',
            message: 'Sincronizzazione completata.',
            details: result
        });
    } catch (error) {
        console.error('[API] Errore durante la sincronizzazione:', error.message);
        if (error.code === 'SYNC_IN_PROGRESS') {
            return res.status(409).json({
                status: 'error',
                message: 'È già in corso una sincronizzazione.'
            });
        }
        return res.status(500).json({
            status: 'error',
            message: 'Errore durante la sincronizzazione.'
        });
    }
});

export default router;
