import { Router } from 'express';
import { sincronizzaEPersisti } from '../services/syncAndPersist.js';
import { esportaProdottiB2B } from '../services/b2bExportService.js';

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
        if (escluse.length > 0) {
            const elenco = escluse.slice(0, 20).map(item => `${item.codice || '(vuoto)'}: ${item.motivo}`);
            console.warn(`[EXPORT] ${escluse.length} articoli esclusi dal file. Primi: ${elenco.join('; ')}`);
        }
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

export default router;
