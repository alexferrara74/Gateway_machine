const express = require('express');
const cron = require('node-cron');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { eseguiSincronizzazione } = require('./services/rentalService');

const app = express();
app.use(express.json());

// Registrazione rotte
app.use('/api/noleggi', apiRoutes);

// Scheduler Notturno (Esecuzione automatica ogni giorno alle ore 02:00)
cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Avvio job notturno di sincronizzazione automatica...');
    const mesi = parseInt(process.env.MESI_STORICO) || 2;
    try {
        await eseguiSincronizzazione(mesi);
    } catch (err) {
        console.error('[CRON] Errore critico durante il task notturno:', err);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] Servizio Node.js avviato e in ascolto sulla porta ${PORT}`);
});