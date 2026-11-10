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
    host: process.env.HOST || undefined,
    // Facoltativo: se valorizzato, /api richiede 'Authorization: Bearer <token>'.
    syncApiToken: (process.env.SYNC_API_TOKEN || '').trim(),
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
    // Export B2B (file prodotti.csv per il sito Sana Breakfast): categorie articolo e listino di vendita.
    b2bExport: {
        categoryIds: readIntegerList('EXPORT_B2B_CATEGORIE_IDS'),
        priceListId: readInteger('EXPORT_B2B_LISTINO_ID', 0, 0, 2147483647),
        // Generazione periodica del file: scritto in una cartella locale e/o caricato via SFTP sul sito.
        cronEnabled: readBoolean('EXPORT_B2B_CRON_ENABLED', false),
        cronSchedule: process.env.EXPORT_B2B_CRON_SCHEDULE || '0 */3 * * *',
        outputDir: (process.env.EXPORT_B2B_OUTPUT_DIR || '').trim(),
        sftp: {
            host: (process.env.EXPORT_B2B_SFTP_HOST || '').trim(),
            port: readInteger('EXPORT_B2B_SFTP_PORT', 22, 1, 65535),
            username: (process.env.EXPORT_B2B_SFTP_USER || '').trim(),
            password: process.env.EXPORT_B2B_SFTP_PASSWORD || '',
            privateKeyPath: (process.env.EXPORT_B2B_SFTP_PRIVATE_KEY_PATH || '').trim(),
            remoteDir: (process.env.EXPORT_B2B_SFTP_REMOTE_DIR || '').trim(),
            hostFingerprint: (process.env.EXPORT_B2B_SFTP_HOST_FINGERPRINT || '').trim()
        }
    },
    invoiceStartYear: readInteger('SYNC_FATTURE_DA_ANNO', 2011, 2000, 2100),
    cronEnabled: readBoolean('CRON_ENABLED', true),
    cronSchedule: process.env.CRON_SCHEDULE || '0 2 * * *'
};

/** Con il cron dell'export attivo la configurazione deve essere completa fin dall'avvio, non alla prima esecuzione. */
function validateB2bExport() {
    const { cronEnabled, cronSchedule, categoryIds, priceListId, outputDir, sftp } = config.b2bExport;
    if (!cronEnabled) return;

    if (!cron.validate(cronSchedule)) {
        throw new Error("EXPORT_B2B_CRON_SCHEDULE non è un'espressione cron valida.");
    }
    if (categoryIds.length === 0 || priceListId === 0) {
        throw new Error('Con EXPORT_B2B_CRON_ENABLED configurare EXPORT_B2B_CATEGORIE_IDS ed EXPORT_B2B_LISTINO_ID.');
    }
    if (!outputDir && !sftp.host) {
        throw new Error('Con EXPORT_B2B_CRON_ENABLED indicare dove consegnare il file: EXPORT_B2B_OUTPUT_DIR e/o EXPORT_B2B_SFTP_HOST.');
    }
    if (sftp.host) {
        const missing = [
            ['EXPORT_B2B_SFTP_USER', sftp.username],
            ['EXPORT_B2B_SFTP_REMOTE_DIR', sftp.remoteDir],
            ['EXPORT_B2B_SFTP_PASSWORD o EXPORT_B2B_SFTP_PRIVATE_KEY_PATH', sftp.password || sftp.privateKeyPath],
            ['EXPORT_B2B_SFTP_HOST_FINGERPRINT', sftp.hostFingerprint]
        ].filter(([, value]) => !value).map(([name]) => name);
        if (missing.length > 0) {
            throw new Error(`Configurazione SFTP incompleta: ${missing.join(', ')}.`);
        }
    }
}

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
    validateB2bExport();
}

export { config, validateConfig };
