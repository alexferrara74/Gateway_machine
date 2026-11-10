import db from '../config/db.js';
import { config } from '../config/config.js';

// Tracciato del file: sanabreakfasthotel/docs/tracciato-prodotti.md (colonne e regole dell'import).
const COLONNE = ['codice', 'descrizione', 'categoria', 'um', 'prezzo', 'iva', 'giacenza', 'attivo'];
const CODICE_RE = /^[A-Z0-9][A-Z0-9._/-]{0,29}$/;

const testo = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function csvField(value) {
    const text = String(value);
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Prezzo con il punto, da 2 a 4 decimali: 7.5 → "7.50", 0.185 → "0.185". */
function formatPrice(value) {
    return value.toFixed(4).replace(/(\.\d{2}\d{0,2}?)0*$/, '$1');
}

/** Converte una riga ERP nella riga del tracciato, oppure indica perché va esclusa. */
function convertiRiga(row) {
    const codice = String(row.codice ?? '').trim().toUpperCase();
    if (!CODICE_RE.test(codice)) return { codice, motivo: 'codice non valido' };

    const descrizione = testo(row.descrizione, 200);
    if (!descrizione) return { codice, motivo: 'descrizione vuota' };

    const prezzo = Number(row.prezzo);
    if (!(prezzo > 0)) return { codice, motivo: 'prezzo mancante nel listino' };

    const iva = Number(row.iva);
    if (row.iva == null || !Number.isInteger(iva) || iva < 0 || iva > 99) {
        return { codice, motivo: 'IVA mancante o non intera' };
    }

    return {
        codice,
        riga: [
            codice,
            descrizione,
            testo(row.categoria, 60),
            testo(row.um, 10).toLowerCase() || 'pz',
            formatPrice(prezzo),
            iva,
            Math.max(0, Math.trunc(Number(row.giacenza) || 0)),
            Number(row.bloccato) ? 0 : 1
        ].map(csvField).join(';')
    };
}

/**
 * Costruisce il CSV. Il sito scarta l'intero file se una riga è sbagliata, quindi gli articoli
 * non esportabili (senza prezzo o IVA, codici doppi o non validi) restano fuori e vengono elencati in `escluse`.
 */
function buildProdottiCsv(rows) {
    const righe = [];
    const escluse = [];
    const visti = new Set();

    for (const row of rows) {
        const { codice, riga, motivo } = convertiRiga(row);
        if (motivo || visti.has(codice)) {
            escluse.push({ codice, motivo: motivo ?? 'codice duplicato' });
            continue;
        }
        visti.add(codice);
        righe.push(riga);
    }

    return {
        csv: [COLONNE.join(';'), ...righe].join('\n') + '\n',
        esportate: righe.length,
        escluse
    };
}

async function esportaProdottiB2B() {
    const { categoryIds, priceListId } = config.b2bExport;
    if (categoryIds.length === 0 || priceListId === 0) {
        const error = new Error('Configurare EXPORT_B2B_CATEGORIE_IDS ed EXPORT_B2B_LISTINO_ID.');
        error.code = 'EXPORT_CONFIG';
        throw error;
    }

    // Prezzo: ultima riga inserita (lid più alto) dell'articolo nel listino scelto, colonna lprz1.
    // Giacenza: somma dei pezzi a lotto (lotti); gli articoli senza lotti risultano 0.
    const [rows] = await db.query(`
        SELECT
            art.artcod AS codice,
            art.artdescr AS descrizione,
            csc.clscdescr AS categoria,
            art.artumven AS um,
            p.prezzo AS prezzo,
            iva.ivaaliq AS iva,
            COALESCE(g.giacenza, 0) AS giacenza,
            art.artbloccato AS bloccato
        FROM articoli art
        LEFT JOIN classisottoclassi csc ON csc.clscid = art.artclscid
        LEFT JOIN comunejazz.codiva iva ON iva.ivaid = art.artcodivaid
        LEFT JOIN (
            SELECT l.lartid, l.lprz1 AS prezzo
            FROM listini l
            JOIN (
                SELECT lartid, MAX(lid) AS lid FROM listini WHERE llistid = ? GROUP BY lartid
            ) ultimo ON ultimo.lid = l.lid
        ) p ON p.lartid = art.artid
        LEFT JOIN (
            SELECT lotartid, SUM(lotpezzigiac) AS giacenza FROM lotti GROUP BY lotartid
        ) g ON g.lotartid = art.artid
        WHERE art.artclscid IN (?)
        ORDER BY art.artcod
    `, [priceListId, categoryIds]);

    const result = buildProdottiCsv(rows);
    if (result.esportate === 0) {
        const error = new Error('Nessun articolo esportabile con la configurazione attuale.');
        error.code = 'EXPORT_EMPTY';
        throw error;
    }
    return result;
}

export { buildProdottiCsv, esportaProdottiB2B };
