import db from '../config/db.js';
import SyncPayloadDto from '../dtos/syncPayloadDto.js';

export async function eseguiSincronizzazione(mesiStorico = 6) {
    try {
        const dataLimite = new Date();
        dataLimite.setMonth(dataLimite.getMonth() - mesiStorico);
        const dataFormattata = dataLimite.toISOString().split('T')[0];
        
        const annoCorrente = new Date().getFullYear();
        const annoInizio = dataLimite.getFullYear();
        
        const tabelleTestata = [];
        const tabelleCorpo = [];
        for (let y = annoInizio; y <= annoCorrente; y++) {
            tabelleTestata.push(`testatadoc${y}${y}`);
            tabelleCorpo.push(`corpodocmag${y}${y}`);
        }

        console.log(`[SYNC] 🚀 Avvio estrazione TUTTI i DDT dal: ${dataFormattata} (Anni analizzati: ${annoInizio}-${annoCorrente})`);
        
        // ==========================================
        // STEP 1: Recupero di TUTTI i documenti senza filtri restrittivi sui clienti
        // ==========================================
        let noleggiResult = [];

        for (let i = 0; i < tabelleTestata.length; i++) {
            const tTestata = tabelleTestata[i];
            const tCorpo = tabelleCorpo[i];

            try {
                console.log(`[SYNC] 🔍 Controllo tabelle: ${tTestata} / ${tCorpo}...`);
                const [rows] = await db.query(`
                    SELECT 
                        r.corpomagid AS doc_id,
                        r.corpomagsufdoc AS sezionale,
                        r.corpomagdtdoc AS abbondatainiz,
                        t.testaanagid AS abboncliid,
                        r.corpomagartid AS abbonartid,
                        r.corpomaglotto AS abbonmatricola,
                        r.corpomagqta AS quantita
                    FROM ${tTestata} t
                    JOIN ${tCorpo} r ON t.testamovdocid = r.corpomagmovdocid
                    WHERE r.corpomagdtdoc >= ?
                `, [dataFormattata]);

                if (Array.isArray(rows) && rows.length > 0) {
                    console.log(`[SYNC]    -> Trovati ${rows.length} record in ${tCorpo}`);
                    noleggiResult.push(...rows);
                }
            } catch (err) {
                console.log(`[SYNC]    -> Tabella ${tTestata} non presente o saltata (${err.message})`);
            }
        }

        const noleggi = Array.isArray(noleggiResult) ? noleggiResult : [];
        console.log(`[SYNC] 📦 Totale documenti grezzi trovati: ${noleggi.length}`);

        // Estrazione automatica degli ID clienti e matricole dai documenti trovati
        const anagIds = [...new Set(noleggi.map(n => n.abboncliid).filter(id => id !== null && id !== undefined && id > 0))];
        const matricole = [...new Set(noleggi.map(n => n.abbonmatricola).filter(Boolean))];

        // ==========================================
        // STEP 2: Recupero Anagrafica Clienti trovati nei documenti
        // ==========================================
        let clienti = [];
        if (anagIds.length > 0) {
            console.log(`[SYNC] 🔍 Esecuzione query su comuneJazz.anagr per i clienti trovati:`, anagIds);
            
            const [anagRows] = await db.query(`
                SELECT 
                    anagid,
                    anagcod,
                    anagragsoc,
                    anagnome,
                    anagcognome,
                    anagcellulare,
                    anagemailpec,
                    anagpiva,
                    anagcodfisc
                FROM comuneJazz.anagr 
                WHERE anagid IN (?)
            `, [anagIds]);

            if (Array.isArray(anagRows)) {
                clienti = anagRows.map(a => ({
                    id: a.anagid,
                    codice: a.anagcod || '',
                    ragioneSociale: a.anagragsoc || '',
                    nome: a.anagnome || '',
                    cognome: a.anagcognome || '',
                    telefono: a.anagcellulare || '',
                    email: a.anagemailpec || '',
                    partitaIva: a.anagpiva || '',
                    codiceFiscale: a.anagcodfisc || '',
                    tipoListino: 0
                }));
            }
            console.log(`[SYNC] 🏢 Anagrafiche clienti mappate: ${clienti.length}`);
        }

        // ==========================================
        // STEP 3: Recupero Attrezzature (per matricola)
        // ==========================================
        let attrezzature = [];
        if (matricole.length > 0) {
            console.log(`[SYNC] 🔍 Ricerca attrezzature per matricola:`, matricole);
            const [res] = await db.query(`SELECT * FROM attrezzature WHERE attrezmatricola IN (?)`, [matricole]);
            attrezzature = Array.isArray(res) ? res : [];
            console.log(`[SYNC] 🛠️ Attrezzature caricate: ${attrezzature.length}`);
        }

        // ==========================================
        // STEP 4: Prodotti filtrati per le categorie configurate nel .env (SYNC_ANAG_IDS)
        // ==========================================
        let prodottiAcquistati = [];
        const envCatString = process.env.SYNC_ANAG_IDS; // Legge la lista di ID categoria dal .env

        if (envCatString && envCatString.trim() !== '') {
            const categoriaIds = envCatString
                .split(',')
                .map(id => parseInt(id.trim(), 10))
                .filter(id => !isNaN(id));

            if (categoriaIds.length > 0) {
                console.log(`[SYNC] 🎯 Categorie di prodotti target configurate da .env (clscid):`, categoriaIds);
                const catListString = categoriaIds.join(',');

                for (let i = 0; i < tabelleTestata.length; i++) {
                    const tTestata = tabelleTestata[i];
                    const tCorpo = tabelleCorpo[i];
                    try {
                        let query = `
                            SELECT 
                                t.testaanagid AS cliente_id, 
                                art.artid, 
                                art.artcod, 
                                art.artdescr, 
                                art.artclscid AS categoria_id, 
                                csc.clscdescr AS categoria_descrizione,
                                csc.clcod AS classe_codice,
                                csc.sccod AS sottoclasse_codice,
                                r.corpomagqta AS quantita, 
                                r.corpomagdtdoc AS data_doc
                            FROM ${tTestata} t
                            JOIN ${tCorpo} r ON t.testamovdocid = r.corpomagmovdocid
                            LEFT JOIN articoli art ON r.corpomagartid = art.artid
                            LEFT JOIN classisottoclassi csc ON art.artclscid = csc.clscid
                            WHERE r.corpomagdtdoc >= ?
                              AND art.artclscid IN (${catListString})
                        `;
                        let params = [dataFormattata];

                        const [res] = await db.query(query, params);
                        if (Array.isArray(res) && res.length > 0) {
                            prodottiAcquistati.push(...res);
                        }
                    } catch (e) {
                        console.log(`[SYNC] ⚠️ Errore ricerca prodotti in ${tCorpo}:`, e.message);
                    }
                }
            } else {
                console.log(`[SYNC] ⚠️ Nessun ID categoria valido trovato in SYNC_ANAG_IDS. Prodotti saltati.`);
            }
        } else {
            console.log(`[SYNC] ⚠️ SYNC_ANAG_IDS non definito o vuoto. Nessun prodotto filtrato per categoria.`);
        }

        console.log(`[SYNC] 📦 Totale prodotti filtrati per categoria trovati: ${prodottiAcquistati.length}`);

        // ==========================================
        // STEP 5: Generazione DTO e Risposta Finale
        // ==========================================
        const payloadDto = new SyncPayloadDto(noleggi, clienti, attrezzature, prodottiAcquistati);

        console.log("[SYNC] ✅ Sincronizzazione completata con successo.");

        return {
            success: true,
            statistiche: {
                noleggiProcessati: noleggi.length,
                clientiCoinvolti: clienti.length,
                attrezzatureCoinvolte: attrezzature.length,
                prodottiAcquistatiTrovati: prodottiAcquistati.length
            },
            payload: payloadDto
        };

    } catch (error) {
        console.error("[SYNC] ❌ Errore critico durante l'estrazione:", error.message);
        throw error;
    }
}