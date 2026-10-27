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
    dbLocal: {
        host: process.env.DB_NUOVO_HOST,
        port: readInteger('DB_NUOVO_PORT', 3306, 1, 65535),
        user: process.env.DB_NUOVO_USER,
        password: process.env.DB_NUOVO_PASSWORD,
        database: process.env.DB_NUOVO_NAME,
        connectionLimit: readInteger('DB_NUOVO_POOL_SIZE', 10, 1, 100)
    },
    syncTriggerToken: process.env.SYNC_TRIGGER_TOKEN,
    ddtNoleggioTipo: process.env.DDT_NOLEGGIO_TIPO?.trim() || null,
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
        ['DB_NUOVO_HOST', config.dbLocal.host],
        ['DB_NUOVO_USER', config.dbLocal.user],
        ['DB_NUOVO_PASSWORD', config.dbLocal.password],
        ['DB_NUOVO_NAME', config.dbLocal.database],
        ['SYNC_TRIGGER_TOKEN', config.syncTriggerToken]
    ];
    const missing = required
        .filter(([, value]) => !value || !value.trim())
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Configurazione mancante nel file .env: ${missing.join(', ')}.`);
    }
    if (config.ddtNoleggioTipo && config.ddtNoleggioTipo.length > 3) {
        throw new Error('DDT_NOLEGGIO_TIPO deve contenere al massimo 3 caratteri.');
    }

    if (config.cronEnabled && !cron.validate(config.cronSchedule)) {
        throw new Error("CRON_SCHEDULE non è un'espressione cron valida.");
    }
}

export { config, validateConfig };
