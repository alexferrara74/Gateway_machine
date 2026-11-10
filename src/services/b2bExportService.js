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

/** Scrive nel log gli articoli esclusi dal file (i primi 20, con il motivo). */
function logEscluse(escluse) {
    if (escluse.length === 0) return;
    const elenco = escluse.slice(0, 20).map(item => `${item.codice || '(vuoto)'}: ${item.motivo}`);
    console.warn(`[EXPORT] ${escluse.length} articoli esclusi dal file. Primi: ${elenco.join('; ')}`);
}

// Tipi documento che non muovono il magazzino: ordini cliente (6) e ordini a fornitore (7).
const DOC_ORDINI = [6, 7];

/**
 * Giacenza dal registro movimenti dell'anno in corso: giacenze iniziali + carichi (acquisti, resi da cliente)
 * - scarichi (vendite, omaggi, resi a fornitore, scarichi interni, trasferimenti). Segno dalla causale (caumag.cmtipo:
 * 0 e 1 = carico, 2 = scarico, 3 = nessun effetto). Il registro riparte ogni anno con le giacenze iniziali.
 * Solo gli articoli con movimenti nell'anno hanno un valore: per gli altri la giacenza non è gestita nell'ERP.
 */
async function caricaGiacenze(categoryIds) {
    const anno = new Date().getFullYear();
    try {
        const [rows] = await db.query(`
            SELECT r.corpomagartid AS articolo_id,
                   SUM(CASE c.cmtipo WHEN 0 THEN r.corpomagqta WHEN 1 THEN r.corpomagqta WHEN 2 THEN -r.corpomagqta ELSE 0 END) AS giacenza
            FROM corpodocmag${anno}${anno} r
            JOIN movimentidoc${anno}${anno} m ON m.movdocid = r.corpomagmovdocid
            JOIN documenti d ON d.docid = m.movdocdocumid
            JOIN caumag c ON c.cmid = r.corpomagcaumag
            WHERE d.doctipo NOT IN (?)
              AND r.corpomagartid IN (SELECT artid FROM articoli WHERE artclscid IN (?))
            GROUP BY r.corpomagartid
        `, [DOC_ORDINI, categoryIds]);
        return new Map(rows.map(row => [Number(row.articolo_id), Number(row.giacenza)]));
    } catch (error) {
        if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
        console.warn(`[EXPORT] Tabelle movimenti ${anno} non presenti: giacenza 0 per tutti gli articoli.`);
        return new Map();
    }
}

async function esportaProdottiB2B() {
    const { categoryIds, priceListId } = config.b2bExport;
    if (categoryIds.length === 0 || priceListId === 0) {
        const error = new Error('Configurare EXPORT_B2B_CATEGORIE_IDS ed EXPORT_B2B_LISTINO_ID.');
        error.code = 'EXPORT_CONFIG';
        throw error;
    }

    // Prezzo: ultima riga inserita (lid più alto) dell'articolo nel listino scelto, colonna lprz1.
    const [articoli] = await db.query(`
        SELECT
            art.artid AS articolo_id,
            art.artcod AS codice,
            art.artdescr AS descrizione,
            csc.clscdescr AS categoria,
            art.artumven AS um,
            p.prezzo AS prezzo,
            iva.ivaaliq AS iva,
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
        WHERE art.artclscid IN (?)
        ORDER BY art.artcod
    `, [priceListId, categoryIds]);

    const giacenze = await caricaGiacenze(categoryIds);
    const rows = articoli.map(articolo => ({ ...articolo, giacenza: giacenze.get(Number(articolo.articolo_id)) ?? 0 }));

    const result = buildProdottiCsv(rows);
    if (result.esportate === 0) {
        const error = new Error('Nessun articolo esportabile con la configurazione attuale.');
        error.code = 'EXPORT_EMPTY';
        throw error;
    }
    return result;
}

export { buildProdottiCsv, esportaProdottiB2B, logEscluse };
