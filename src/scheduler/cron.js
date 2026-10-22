import cron from 'node-cron';
import { config } from '../config/config.js';
import { sincronizzaDdtNoleggio } from '../services/syncService.js';

function initCronJobs() {
    if (!config.cronEnabled) {
        console.log('[CRON] Scheduler disabilitato da configurazione.');
        return null;
    }

    const task = cron.schedule(config.cronSchedule, async () => {
        console.log('[CRON] Avvio sincronizzazione DDT noleggio.');
        try {
            await sincronizzaDdtNoleggio(config.mesiStorico);
        } catch (error) {
            console.error('[CRON] Sincronizzazione fallita:', error.message);
        }
    });
    console.log(`[CRON] Scheduler attivo: ${config.cronSchedule}.`);
    return task;
}

export { initCronJobs };