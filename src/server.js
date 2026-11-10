import { config, validateConfig } from './config/config.js';
import { initCronJobs } from './scheduler/cron.js';
import app from './app.js';

validateConfig();
const cronTask = initCronJobs();

if (!config.syncApiToken) {
    console.warn('[SICUREZZA] SYNC_API_TOKEN non impostato: chi raggiunge il servizio può avviare la sincronizzazione.');
}

const listenArgs = [config.port, ...(config.host ? [config.host] : [])];
const server = app.listen(...listenArgs, () => {
    console.log(`Server attivo su ${config.host ?? 'tutte le interfacce'}:${config.port}.`);
});

function shutdown() {
    cronTask?.stop();
    server.close(async (error) => {
        if (error) {
            console.error('[SERVER] Errore durante la chiusura:', error.message);
            process.exitCode = 1;
        }
        try {
            const [{ default: db }, { default: dbLocal }] = await Promise.all([
                import('./config/db.js'),
                import('./config/dbLocal.js')
            ]);
            await Promise.all([db.end(), dbLocal.end()]);
        } catch (closeError) {
            console.error('[SERVER] Errore durante la chiusura dei database:', closeError.message);
            process.exitCode = 1;
        }
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
