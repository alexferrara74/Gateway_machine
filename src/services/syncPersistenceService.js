import dbNuovo from '../config/dbLocal.js';

async function storicizzaPayloadCompleto(payload) {
    const connection = await dbNuovo.getConnection();
    let transactionStarted = false;
    try {
        await connection.beginTransaction();
        transactionStarted = true;

        for (const cliente of payload.clienti) {
            if (cliente.id == null) continue;

            await connection.query(`
                INSERT INTO local_clienti
                    (id, codice, ragione_sociale, nome, cognome, telefono, email,
                     partita_iva, codice_fiscale, tipo_listino)
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
                cliente.id, cliente.codice, cliente.ragioneSociale, cliente.nome,
                cliente.cognome, cliente.telefono, cliente.email, cliente.partitaIva,
                cliente.codiceFiscale, cliente.tipoListino
            ]);
        }

        for (const attrezzatura of payload.attrezzature) {
            if (!attrezzatura.matricola) continue;

            await connection.query(`
                INSERT INTO local_attrezzature (matricola, descrizione, modello, marca, stato)
                VALUES (?, ?, ?, ?, 'DISPONIBILE')
                ON DUPLICATE KEY UPDATE
                    descrizione = VALUES(descrizione),
                    modello = VALUES(modello)
            `, [
                attrezzatura.matricola,
                attrezzatura.note || 'Attrezzatura',
                attrezzatura.modello,
                ''
            ]);
        }

        for (const noleggio of payload.noleggi) {
            if (noleggio.annoErp == null || noleggio.idRigaErp == null) {
                throw new Error('Riga DDT senza anno o ID ERP; storicizzazione annullata.');
            }

            await connection.query(`
                INSERT INTO storia_noleggi
                    (erp_anno, erp_riga_id, erp_testata_id, numero_ddt, sezionale,
                     data_doc, cliente_id, articolo_id, matricola, quantita)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    erp_testata_id = VALUES(erp_testata_id),
                    numero_ddt = VALUES(numero_ddt),
                    sezionale = VALUES(sezionale),
                    data_doc = VALUES(data_doc),
                    cliente_id = VALUES(cliente_id),
                    articolo_id = VALUES(articolo_id),
                    matricola = VALUES(matricola),
                    quantita = VALUES(quantita)
            `, [
                noleggio.annoErp,
                noleggio.idRigaErp,
                noleggio.idTestataErp,
                noleggio.numeroDocumento,
                noleggio.sezionale,
                noleggio.dataInizio,
                noleggio.clienteId,
                noleggio.articoloId,
                noleggio.matricola,
                noleggio.quantita
            ]);
        }

        for (const prodotto of payload.prodottiAcquistati) {
            if (prodotto.annoErp == null || prodotto.idRigaErp == null) {
                throw new Error('Riga prodotto senza anno o ID ERP; storicizzazione annullata.');
            }

            await connection.query(`
                INSERT INTO storia_prodotti
                    (erp_anno, erp_riga_id, cliente_id, articolo_id, codice_articolo,
                     descrizione, categoria_id, categoria_descrizione, quantita, data_doc)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    cliente_id = VALUES(cliente_id),
                    articolo_id = VALUES(articolo_id),
                    codice_articolo = VALUES(codice_articolo),
                    descrizione = VALUES(descrizione),
                    categoria_id = VALUES(categoria_id),
                    categoria_descrizione = VALUES(categoria_descrizione),
                    quantita = VALUES(quantita),
                    data_doc = VALUES(data_doc)
            `, [
                prodotto.annoErp,
                prodotto.idRigaErp,
                prodotto.clienteId,
                prodotto.articoloId,
                prodotto.codiceArticolo,
                prodotto.descrizione,
                prodotto.categoriaId,
                prodotto.categoriaDescrizione,
                prodotto.quantita,
                prodotto.dataDocumento
            ]);
        }

        await connection.commit();
        transactionStarted = false;
        console.log(
            `[STORICO] Salvati ${payload.clienti.length} clienti, ` +
            `${payload.attrezzature.length} attrezzature, ${payload.noleggi.length} DDT e ` +
            `${payload.prodottiAcquistati.length} prodotti.`
        );
        return { success: true };
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('[STORICO] Errore durante il rollback:', rollbackError.message);
            }
        }
        throw error;
    } finally {
        connection.release();
    }
}

export { storicizzaPayloadCompleto };
