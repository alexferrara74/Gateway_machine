import db from '../config/db.js';
import { config } from '../config/config.js';
import SyncPayloadDto from '../dtos/syncPayloadDto.js';

function isMissingAnnualTable(error, tableNames) {
    return error.code === 'ER_NO_SUCH_TABLE' &&
        tableNames.some(tableName => error.message.includes(tableName));
}

export async function eseguiSincronizzazione(mesiStorico = config.mesiStorico) {
    if (!config.ddtNoleggioTipo) {
        throw new Error('Configurare DDT_NOLEGGIO_TIPO con il codice del tipo DDT noleggio in ERP.');
    }

    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - mesiStorico);
    const dataFormattata = dataLimite.toISOString().split('T')[0];
    const annoCorrente = new Date().getFullYear();
    const annoInizio = dataLimite.getFullYear();
    const noleggi = [];
    const prodottiAcquistati = [];
    const categorie = (process.env.SYNC_ANAG_IDS || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .map(Number);

    if (categorie.some(id => !Number.isInteger(id) || id < 0)) {
        throw new Error('SYNC_ANAG_IDS deve contenere solo ID categoria interi non negativi.');
    }

    for (let anno = annoInizio; anno <= annoCorrente; anno++) {
        const testataTable = `testatadoc${anno}${anno}`;
        const corpoTable = `corpodocmag${anno}${anno}`;

        try {
            const [rows] = await db.query(`
                SELECT
                    ? AS anno_erp,
                    r.corpomagid AS id_riga_erp,
                    r.corpomagmovdocid AS id_testata_erp,
                    r.corpomagnumdoc AS numero_documento,
                    r.corpomagsufdoc AS sezionale,
                    r.corpomagdoctipo AS tipo_documento,
                    r.corpomagdtdoc AS data_doc,
                    t.testaanagid AS cliente_id,
                    r.corpomagartid AS articolo_id,
                    r.corpomaglotto AS matricola,
                    r.corpomagqta AS quantita
                FROM ${testataTable} t
                JOIN ${corpoTable} r ON t.testamovdocid = r.corpomagmovdocid
                WHERE r.corpomagdtdoc >= ?
                  AND r.corpomagdoctipo = ?
            `, [anno, dataFormattata, config.ddtNoleggioTipo]);
            noleggi.push(...rows);

            if (categorie.length > 0) {
                const [productRows] = await db.query(`
                    SELECT
                        ? AS anno_erp,
                        r.corpomagid AS id_riga_erp,
                        t.testaanagid AS cliente_id,
                        art.artid,
                        art.artcod,
                        art.artdescr,
                        art.artclscid AS categoria_id,
                        csc.clscdescr AS categoria_descrizione,
                        r.corpomagqta AS quantita,
                        r.corpomagdtdoc AS data_doc
                    FROM ${testataTable} t
                    JOIN ${corpoTable} r ON t.testamovdocid = r.corpomagmovdocid
                    LEFT JOIN articoli art ON r.corpomagartid = art.artid
                    LEFT JOIN classisottoclassi csc ON art.artclscid = csc.clscid
                    WHERE r.corpomagdtdoc >= ?
                      AND art.artclscid IN (?)
                `, [anno, dataFormattata, categorie]);
                prodottiAcquistati.push(...productRows);
            }
        } catch (error) {
            if (!isMissingAnnualTable(error, [testataTable, corpoTable])) throw error;
            console.warn(`[SYNC] Tabelle documentali per ${anno} non presenti; anno saltato.`);
        }
    }

    const clientiIds = [...new Set(noleggi.map(record => record.cliente_id)
        .filter(id => Number.isInteger(id) && id > 0))];
    const matricole = [...new Set(noleggi.map(record => record.matricola).filter(Boolean))];

    let clienti = [];
    if (clientiIds.length > 0) {
        const [rows] = await db.query(`
            SELECT anagid, anagcod, anagragsoc, anagnome, anagcognome,
                   anagcellulare, anagemailpec, anagpiva, anagcodfisc
            FROM comunejazz.anagr
            WHERE anagid IN (?)
        `, [clientiIds]);
        clienti = rows.map(record => ({
            id: record.anagid,
            codice: record.anagcod,
            ragioneSociale: record.anagragsoc,
            nome: record.anagnome,
            cognome: record.anagcognome,
            telefono: record.anagcellulare,
            email: record.anagemailpec,
            partitaIva: record.anagpiva,
            codiceFiscale: record.anagcodfisc,
            tipoListino: 0
        }));
    }

    let attrezzature = [];
    if (matricole.length > 0) {
        const [rows] = await db.query(`
            SELECT attrezid, attrezmatricola, attrezmodello, attrezartid
            FROM attrezzature
            WHERE attrezmatricola IN (?)
        `, [matricole]);
        attrezzature = rows;
    }

    const payload = new SyncPayloadDto(noleggi, clienti, attrezzature, prodottiAcquistati);
    return {
        success: true,
        statistiche: {
            noleggiProcessati: noleggi.length,
            clientiCoinvolti: clienti.length,
            attrezzatureCoinvolte: attrezzature.length,
            prodottiAcquistatiTrovati: prodottiAcquistati.length
        },
        payload
    };
}
