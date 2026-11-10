import { Router } from 'express';
import { sincronizzaEPersisti } from '../services/syncAndPersist.js';
import { esportaProdottiB2B, logEscluse } from '../services/b2bExportService.js';
import { generaEConsegnaProdottiB2B } from '../services/b2bExportJob.js';

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

// Solo lettura dall'ERP: il file viene restituito nella risposta, non viene salvato su nessun database.
router.get('/export/prodotti', async (req, res) => {
    try {
        const { csv, esportate, escluse } = await esportaProdottiB2B();
        logEscluse(escluse);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="prodotti.csv"',
            'Cache-Control': 'no-store',
            'X-Righe-Esportate': String(esportate),
            'X-Righe-Escluse': String(escluse.length)
        });
        return res.status(200).send(csv);
    } catch (error) {
        console.error('[API] Errore durante l\'export prodotti:', error.message);
        if (error.code === 'EXPORT_CONFIG') {
            return res.status(503).json({ status: 'error', message: error.message });
        }
        if (error.code === 'EXPORT_EMPTY') {
            return res.status(422).json({ status: 'error', message: error.message });
        }
        return res.status(500).json({ status: 'error', message: 'Errore durante l\'export prodotti.' });
    }
});

// Stessa operazione del cron ogni 3 ore, lanciata a mano: genera il file e lo consegna (cartella locale e/o SFTP).
router.post('/export/prodotti/consegna', async (req, res) => {
    if (req.body && Object.keys(req.body).length > 0) {
        return res.status(400).json({ status: 'error', message: 'Questo endpoint non accetta un body.' });
    }
    try {
        const details = await generaEConsegnaProdottiB2B();
        return res.status(200).json({ status: 'success', message: 'File consegnato.', details });
    } catch (error) {
        console.error('[API] Errore durante la consegna del file prodotti:', error.message);
        const known = {
            EXPORT_CONFIG: [503, error.message],
            EXPORT_EMPTY: [422, error.message],
            EXPORT_IN_PROGRESS: [409, error.message]
        }[error.code];
        const [status, message] = known ?? [500, 'Errore durante la consegna del file prodotti.'];
        return res.status(status).json({ status: 'error', message });
    }
});

export default router;
