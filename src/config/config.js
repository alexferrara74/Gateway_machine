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

function readIntegerList(name, fallbackName) {
    const value = process.env[name] || process.env[fallbackName] || '';
    if (!value.trim()) return [];

    const parsed = value.split(',').map(item => item.trim()).filter(Boolean).map(Number);
    if (parsed.some(item => !Number.isInteger(item) || item < 0)) {
        throw new Error(`${name} deve contenere ID interi non negativi separati da virgola.`);
    }
    return [...new Set(parsed)];
}

function readCodeList(name, maxLength = 10) {
    const value = process.env[name] || '';
    if (!value.trim()) return [];

    const codes = value.split(',').map(item => item.trim()).filter(Boolean);
    if (codes.some(code => code.length > maxLength)) {
        throw new Error(`${name} contiene codici più lunghi di ${maxLength} caratteri.`);
    }
    return [...new Set(codes)];
}

function readSubclassPairs(name) {
    const value = process.env[name] || '';
    if (!value.trim()) return [];

    const subclasses = value.split(',').map(item => {
        const [classCode, subclassCode, ...extra] = item.trim().split(':');
        if (!classCode || !subclassCode || extra.length > 0) {
            throw new Error(
                `${name} usa coppie classe:sottoclasse separate da virgola.`
            );
        }
        if (classCode.length > 10 || subclassCode.length > 10) {
            throw new Error('I codici classe e sottoclasse non possono superare 10 caratteri.');
        }
        return { classCode, subclassCode };
    });

    return subclasses;
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
    productCategoryIds: readIntegerList('SYNC_PRODOTTI_CATEGORIE_IDS', 'SYNC_ANAG_IDS'),
    equipmentClassCodes: readCodeList('SYNC_ATTREZZATURE_CLASSI'),
    equipmentSubclasses: readSubclassPairs('SYNC_ATTREZZATURE_SOTTOCLASSI'),
    accessorySubclasses: readSubclassPairs('SYNC_ACCESSORI_SOTTOCLASSI'),
    invoiceStartYear: readInteger('SYNC_FATTURE_DA_ANNO', 2011, 2000, 2100),
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
        ['DB_NUOVO_NAME', config.dbLocal.database]
    ];
    const missing = required
        .filter(([, value]) => !value || !value.trim())
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Configurazione mancante nel file .env: ${missing.join(', ')}.`);
    }
    if (config.cronEnabled && !cron.validate(config.cronSchedule)) {
        throw new Error("CRON_SCHEDULE non è un'espressione cron valida.");
    }
}

export { config, validateConfig };
