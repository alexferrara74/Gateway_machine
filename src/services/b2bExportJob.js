import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import SftpClient from 'ssh2-sftp-client';
import { config } from '../config/config.js';
import { esportaProdottiB2B, logEscluse } from './b2bExportService.js';

const FILE = 'prodotti.csv';
let running = false;

async function scriviLocale(csv, dir) {
    await mkdir(dir, { recursive: true });
    const part = path.join(dir, `${FILE}.part`);
    await writeFile(part, csv, 'utf8');
    await rename(part, path.join(dir, FILE));
}

const normalizzaImpronta = value => value.replace(/^SHA256:/i, '').replace(/=+$/, '');

/** Accetta solo il server con l'impronta (SHA256, come la mostra `ssh-keygen -lf`) indicata nel .env. */
function verificaImpronta(attesa) {
    return key => {
        const trovata = createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
        if (trovata === normalizzaImpronta(attesa)) return true;
        console.error(`[EXPORT] Impronta del server SFTP non riconosciuta: SHA256:${trovata}. Se è quella del tuo hosting, copiala in EXPORT_B2B_SFTP_HOST_FINGERPRINT.`);
        return false;
    };
}

/**
 * Carica il CSV sul sito: prima come prodotti.csv.part e poi lo rinomina, così l'import non legge mai un file a metà.
 * Un prodotti.csv non ancora elaborato viene sostituito da quello nuovo.
 */
async function consegnaViaSftp(csv, sftp, createClient = () => new SftpClient()) {
    const client = createClient();
    const dir = sftp.remoteDir.replace(/\/+$/, '');
    const part = `${dir}/${FILE}.part`;
    const finale = `${dir}/${FILE}`;
    try {
        await client.connect({
            host: sftp.host,
            port: sftp.port,
            username: sftp.username,
            ...(sftp.password ? { password: sftp.password } : {}),
            ...(sftp.privateKeyPath ? { privateKey: await readFile(sftp.privateKeyPath) } : {}),
            hostVerifier: verificaImpronta(sftp.hostFingerprint),
            readyTimeout: 20000
        });
        await client.put(Buffer.from(csv, 'utf8'), part);
        if (await client.exists(finale)) await client.delete(finale);
        await client.rename(part, finale);
    } finally {
        await client.end().catch(() => {});
    }
}

/** Genera prodotti.csv dall'ERP e lo consegna alle destinazioni configurate. */
async function generaEConsegnaProdottiB2B({ esporta = esportaProdottiB2B, consegna = consegnaViaSftp } = {}) {
    if (running) {
        const error = new Error('Un export prodotti è già in corso.');
        error.code = 'EXPORT_IN_PROGRESS';
        throw error;
    }
    running = true;
    try {
        const { outputDir, sftp } = config.b2bExport;
        if (!outputDir && !sftp.host) {
            const error = new Error('Configurare EXPORT_B2B_OUTPUT_DIR e/o EXPORT_B2B_SFTP_HOST.');
            error.code = 'EXPORT_CONFIG';
            throw error;
        }

        const { csv, esportate, escluse } = await esporta();
        logEscluse(escluse);

        const destinazioni = [];
        if (outputDir) {
            await scriviLocale(csv, outputDir);
            destinazioni.push('cartella locale');
        }
        if (sftp.host) {
            await consegna(csv, sftp);
            destinazioni.push('SFTP');
        }
        return { esportate, escluse: escluse.length, destinazioni };
    } finally {
        running = false;
    }
}

export { consegnaViaSftp, generaEConsegnaProdottiB2B, verificaImpronta };
