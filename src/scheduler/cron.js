import cron from 'node-cron';
import { config } from '../config/config.js';
import { sincronizzaEPersisti } from '../services/syncAndPersist.js';
import { generaEConsegnaProdottiB2B } from '../services/b2bExportJob.js';

function initCronJobs() {
    const tasks = [];

    if (config.cronEnabled) {
        tasks.push(cron.schedule(config.cronSchedule, async () => {
            console.log('[CRON] Avvio sincronizzazione clienti, prodotti e attrezzature.');
            try {
                const result = await sincronizzaEPersisti();
                console.log('[CRON] Sincronizzazione completata:', result.statistiche);
            } catch (error) {
                console.error('[CRON] Sincronizzazione fallita:', error.message);
            }
        }));
        console.log(`[CRON] Scheduler attivo: ${config.cronSchedule}.`);
    } else {
        console.log('[CRON] Scheduler disabilitato da configurazione.');
    }

    if (config.b2bExport.cronEnabled) {
        tasks.push(cron.schedule(config.b2bExport.cronSchedule, async () => {
            console.log('[CRON] Avvio export prodotti B2B.');
            try {
                const result = await generaEConsegnaProdottiB2B();
                console.log('[CRON] Export prodotti B2B completato:', result);
            } catch (error) {
                console.error('[CRON] Export prodotti B2B fallito:', error.message);
            }
        }));
        console.log(`[CRON] Export prodotti B2B attivo: ${config.b2bExport.cronSchedule}.`);
    }

    return tasks.length > 0 ? { stop: () => tasks.forEach(task => task.stop()) } : null;
}

export { initCronJobs };
