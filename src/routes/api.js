const express = require('express');
const router = express.Router();
const { eseguiSincronizzazione } = require('../services/rentalService');
const { storicizzaPayloadCompleto } = require('../services/syncPersistenceService'); // 👈 Importa il servizio di storicizzazione

router.post('/riarmo-sync', async (req, res) => {
    try {
        const mesi = req.body.mesi || parseInt(process.env.MESI_STORICO) || 2;
        console.log(`[API] Riarmo manuale attivato via HTTP. Finestra: ${mesi} mesi.`);
        
        // 1. Esegue la sincronizzazione e recupera i dati
        const result = await eseguiSincronizzazione(mesi);

        // 2. STOCIZZAZIONE: Se l'estrazione è andata a buon fine, salva tutto nel nuovo DB
        if (result && result.payload) {
            await storicizzaPayloadCompleto(result.payload);
            console.log('[API] 📦 Dati storicizzati con successo nel nuovo database.');
        }

        return res.status(200).json({
            status: 'success',
            message: 'Sincronizzazione e storicizzazione completate con successo.',
            details: result
        });
    } catch (error) {
        console.error('[API] ❌ Errore durante il riarmo:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Errore durante il riarmo manuale.',
            error: error.message
        });
    }
});

module.exports = router;