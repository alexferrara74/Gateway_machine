import dbNuovo from '../config/dbLocal.js';

export async function storicizzaPayloadCompleto(payload) {
    try {
        console.log("[STORICO] 🔄 Avvio storicizzazione su DB 'service'...");

        // ==========================================
        // 1. CLIENTi -> local_clienti
        // ==========================================
        if (payload.clienti && payload.clienti.length > 0) {
            for (const c of payload.clienti) {
                if (!c.id) continue;
                
                await dbNuovo.query(`
                    INSERT INTO local_clienti (id, codice, ragione_sociale, nome, cognome, telefono, email, partita_iva, codice_fiscale, tipo_listino)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        codice = VALUES(codice),
                        ragione_sociale = VALUES(ragione_sociale),
                        nome = VALUES(nome),
                        cognome = VALUES(cognome),
                        telefono = VALUES(telefono),
                        email = VALUES(email),
                        partita_iva = VALUES(partita_iva),
                        codice_fiscale = VALUES(codice_fiscale),
                        tipo_listino = VALUES(tipo_listino)
                `, [
                    c.id, 
                    c.codice, 
                    c.ragioneSociale, 
                    c.nome, 
                    c.cognome, 
                    c.telefono, 
                    c.email, 
                    c.partitaIva, 
                    c.codiceFiscale, 
                    c.tipoListino
                ]);
            }
            console.log(`[STORICO] ✅ Clienti salvati/aggiornati: ${payload.clienti.length}`);
        }

        // ==========================================
        // 2. ATTREZZATURE -> local_attrezzature
        // ==========================================
        if (payload.attrezzature && payload.attrezzature.length > 0) {
            for (const att of payload.attrezzature) {
                if (!att.matricola) continue;

                await dbNuovo.query(`
                    INSERT INTO local_attrezzature (matricola, descrizione, modello, marca, stato)
                    VALUES (?, ?, ?, ?, 'DISPONIBILE')
                    ON DUPLICATE KEY UPDATE 
                        descrizione = VALUES(descrizione),
                        modello = VALUES(modello)
                `, [
                    att.matricola, 
                    att.note || 'Attrezzatura', 
                    att.modello || '', 
                    ''
                ]);
            }
            console.log(`[STORICO] ✅ Attrezzature salvate/aggiornate: ${payload.attrezzature.length}`);
        }

        // ==========================================
        // 3. TUTTI I DOCUMENTI DI NOLEGGIO -> storia_noleggi
        // ==========================================
        if (payload.noleggi && payload.noleggi.length > 0) {
            for (const n of payload.noleggi) {
                if (!n.idAbbonamento) continue;

                await dbNuovo.query(`
                    INSERT INTO storia_noleggi (doc_id, sezionale, data_doc, cliente_id, articolo_id, matricola, quantita)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        sezionale = VALUES(sezionale),
                        data_doc = VALUES(data_doc),
                        cliente_id = VALUES(cliente_id),
                        articolo_id = VALUES(articolo_id),
                        matricola = VALUES(matricola),
                        quantita = VALUES(quantita)
                `, [
                    n.idAbbonamento, 
                    n.tipoDocumento || '', 
                    n.dataInizio || null, 
                    n.clienteId || null, 
                    n.articoloId || null, 
                    n.matricola || null, 
                    n.quantita || 1
                ]);
            }
            console.log(`[STORICO] ✅ Noleggi/DDT salvati/aggiornati: ${payload.noleggi.length}`);
        }

       // 4. PRODOTTI ACQUISTATI -> storia_prodotti
        if (payload.prodottiAcquistati && payload.prodottiAcquistati.length > 0) {
            let salvatiCount = 0;
            for (const p of payload.prodottiAcquistati) {
                try {
                    await dbNuovo.query(`
                        INSERT INTO storia_prodotti 
                            (cliente_id, articolo_id, codice_articolo, descrizione, categoria_id, categoria_descrizione, quantita, data_doc)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        p.clienteId || null, 
                        p.articoloId || null, 
                        p.codiceArticolo || '', 
                        p.descrizione || '', 
                        p.categoriaId || null, 
                        p.categoriaDescrizione || '', 
                        p.quantita || 0, 
                        p.dataDocumento || null
                    ]);
                    salvatiCount++;
                } catch (errItem) {
                    console.error(`[STORICO ERRORE ITEM] Impossibile salvare il prodotto ${p.codiceArticolo}:`, errItem.message);
                }
            }
            console.log(`[STORICO] ✅ Prodotti acquistati salvati con successo: ${salvatiCount} su ${payload.prodottiAcquistati.length}`);
        }
        console.log("[STORICO] 🚀 Storicizzazione completata con successo!");
        return { success: true, message: "Dati storicizzati correttamente." };

    } catch (error) {
        console.error("[STORICO] ❌ Errore durante la storicizzazione:", error.message);
        throw error;
    }
}