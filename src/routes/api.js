import { Router } from 'express';
import { sincronizzaEPersisti } from '../services/syncAndPersist.js';

const router = Router();

router.post('/sincronizza', async (req, res) => {
    if (req.body && Object.keys(req.body).length > 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Questo endpoint non accetta un body.'
        });
    }

    try {
        const result = await sincronizzaEPersisti();
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
