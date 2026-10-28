import cron from 'node-cron';
import { config } from '../config/config.js';
import { sincronizzaEPersisti } from '../services/syncAndPersist.js';

function initCronJobs() {
    if (!config.cronEnabled) {
        console.log('[CRON] Scheduler disabilitato da configurazione.');
        return null;
    }

    const task = cron.schedule(config.cronSchedule, async () => {
        console.log('[CRON] Avvio sincronizzazione clienti, prodotti e attrezzature.');
        try {
            const result = await sincronizzaEPersisti();
            console.log('[CRON] Sincronizzazione completata:', result.statistiche);
        } catch (error) {
            console.error('[CRON] Sincronizzazione fallita:', error.message);
        }
    });
    console.log(`[CRON] Scheduler attivo: ${config.cronSchedule}.`);
    return task;
}

export { initCronJobs };