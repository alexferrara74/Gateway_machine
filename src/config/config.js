import 'dotenv/config';
import cron from 'node-cron';

function readBoolean(name, defaultValue) {
    const value = process.env[name];
    if (value === undefined) return defaultValue;
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    throw new Error(`${name} deve essere true oppure false.`);
}

function readInteger(name, defaultValue, minimum, maximum) {
    const value = process.env[name];
    if (value === undefined || value === '') return defaultValue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`${name} deve essere un intero tra ${minimum} e ${maximum}.`);
    }
    return parsed;
}

const categoryId = Number(process.env.CATEGORIA_ATTREZZATURE_ID);

const config = {
    port: readInteger('PORT', 3000, 1, 65535),
    db: {
        host: process.env.DB_HOST,
        port: readInteger('DB_PORT', 3306, 1, 65535),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: readInteger('DB_POOL_SIZE', 5, 1, 100)
    },
    apiUrl: process.env.API_URL,
    apiToken: process.env.API_TOKEN,
    apiTimeoutMs: readInteger('API_TIMEOUT_MS', 30000, 1000, 300000),
    syncTriggerToken: process.env.SYNC_TRIGGER_TOKEN,
    categoriaAttrezzatureId: categoryId,
    mesiStorico: readInteger('MESI_STORICO', 2, 1, 120),
    cronEnabled: readBoolean('CRON_ENABLED', true),
    cronSchedule: process.env.CRON_SCHEDULE || '0 2 * * *'
};

function validateConfig() {
    const required = [
        ['DB_HOST', config.db.host],
        ['DB_USER', config.db.user],
        ['DB_PASSWORD', config.db.password],
        ['DB_NAME', config.db.database],
        ['API_URL', config.apiUrl],
        ['API_TOKEN', config.apiToken],
        ['SYNC_TRIGGER_TOKEN', config.syncTriggerToken]
    ];
    const missing = required
        .filter(([, value]) => !value || !value.trim())
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Configurazione mancante nel file .env: ${missing.join(', ')}.`);
    }
    if (!Number.isInteger(categoryId) || categoryId < 0) {
        throw new Error('CATEGORIA_ATTREZZATURE_ID deve essere un intero maggiore o uguale a zero.');
    }

    let apiUrl;
    try {
        apiUrl = new URL(config.apiUrl);
    } catch {
        throw new Error('API_URL deve essere un URL assoluto valido.');
    }
    if (!['http:', 'https:'].includes(apiUrl.protocol)) {
        throw new Error('API_URL deve usare il protocollo HTTP o HTTPS.');
    }

    if (config.cronEnabled && !cron.validate(config.cronSchedule)) {
        throw new Error("CRON_SCHEDULE non è un'espressione cron valida.");
    }
}

export { config, validateConfig };
