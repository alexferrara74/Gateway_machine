import dbNuovo from '../config/dbLocal.js';

async function storicizzaPayloadCompleto(payload) {
    const connection = await dbNuovo.getConnection();
    let transactionStarted = false;
    try {
        await connection.beginTransaction();
        transactionStarted = true;

        await connection.query('DELETE FROM local_classi_sottoclassi');
        for (const category of payload.classiSottoclassi) {
            if (category.id == null) continue;

            await connection.query(`
                INSERT INTO local_classi_sottoclassi
                    (categoria_id, classe_codice, sottoclasse_codice, descrizione, tipo)
                VALUES (?, ?, ?, ?, ?)
            `, [
                category.id,
                category.classeCodice,
                category.sottoclasseCodice,
                category.descrizione,
                category.tipo
            ]);
        }

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
                    codice_fiscale = VALUES(codice_fiscale)
            `, [
                cliente.id, cliente.codice, cliente.ragioneSociale, cliente.nome,
                cliente.cognome, cliente.telefono, cliente.email, cliente.partitaIva,
                cliente.codiceFiscale, 0
            ]);
        }

        const equipmentIds = new Set(payload.attrezzature.map(item => item.id));
        const accessoryIds = new Set(payload.accessori.map(item => item.id));
        const products = new Map(
            payload.prodotti.map(product => [product.id, { ...product, isAttrezzatura: false }])
        );
        for (const accessory of payload.accessori) {
            products.set(accessory.id, { ...accessory, isAttrezzatura: false });
        }
        for (const equipment of payload.attrezzature) {
            products.set(equipment.id, { ...equipment, isAttrezzatura: true });
        }

        // Rimuove solo i record scritti dal sync (origine 'ERP') che l'ERP non
        // restituisce più; i record inseriti a mano non vengono mai toccati.
        // Le attrezzature con matricola non vengono eliminate: sono state curate.
        const syncedIds = [...products.keys()].filter(id => id != null);
        if (syncedIds.length > 0) {
            await connection.query(`
                DELETE FROM local_attrezzature
                WHERE origine = 'ERP' AND matricola IS NULL
                  AND (articolo_id IS NULL OR articolo_id NOT IN (?))
            `, [[...equipmentIds].filter(id => id != null).concat(-1)]);
            await connection.query(`
                DELETE FROM local_prodotti
                WHERE origine = 'ERP' AND articolo_id NOT IN (?)
                  AND articolo_id NOT IN (SELECT articolo_id FROM local_attrezzature
                                          WHERE articolo_id IS NOT NULL)
            `, [syncedIds]);
        }

        for (const product of products.values()) {
            if (product.id == null) continue;

            await connection.query(`
                INSERT INTO local_prodotti
                    (articolo_id, codice, descrizione, categoria_id, categoria_descrizione,
                     classe_codice, sottoclasse_codice, is_attrezzatura, is_accessorio, origine)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ERP')
                ON DUPLICATE KEY UPDATE
                    codice = VALUES(codice),
                    descrizione = VALUES(descrizione),
                    categoria_id = VALUES(categoria_id),
                    categoria_descrizione = VALUES(categoria_descrizione),
                    classe_codice = VALUES(classe_codice),
                    sottoclasse_codice = VALUES(sottoclasse_codice),
                    is_attrezzatura = VALUES(is_attrezzatura),
                    is_accessorio = VALUES(is_accessorio)
            `, [
                product.id, product.codice, product.descrizione, product.categoriaId,
                product.categoriaDescrizione, product.classeCodice,
                product.sottoclasseCodice, equipmentIds.has(product.id) ? 1 : 0,
                accessoryIds.has(product.id) ? 1 : 0
            ]);
        }

        for (const equipment of payload.attrezzature) {
            if (equipment.id == null) continue;

            await connection.query(`
                INSERT INTO local_attrezzature
                    (articolo_id, matricola, descrizione, modello, marca, stato, origine)
                VALUES (?, NULL, ?, ?, ?, 'DISPONIBILE', 'ERP')
                ON DUPLICATE KEY UPDATE
                    descrizione = VALUES(descrizione),
                    modello = VALUES(modello)
            `, [equipment.id, equipment.descrizione, equipment.modello, equipment.marca]);
        }

        for (const customerProducts of payload.prodottiFatturatiPerCliente) {
            for (const product of customerProducts.prodotti) {
                if (product.annoErp == null || product.idRigaErp == null) {
                    throw new Error(
                        'Riga fattura senza anno o ID ERP; storicizzazione annullata.'
                    );
                }

                await connection.query(`
                    INSERT INTO storia_prodotti
                        (erp_anno, erp_riga_id, cliente_id, codice_cliente, articolo_id,
                         codice_articolo, descrizione, categoria_id,
                         categoria_descrizione, quantita, data_doc, origine)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ERP')
                    ON DUPLICATE KEY UPDATE
                        cliente_id = VALUES(cliente_id),
                        codice_cliente = VALUES(codice_cliente),
                        articolo_id = VALUES(articolo_id),
                        codice_articolo = VALUES(codice_articolo),
                        descrizione = VALUES(descrizione),
                        categoria_id = VALUES(categoria_id),
                        categoria_descrizione = VALUES(categoria_descrizione),
                        quantita = VALUES(quantita),
                        data_doc = VALUES(data_doc)
                `, [
                    product.annoErp,
                    product.idRigaErp,
                    customerProducts.clienteId,
                    customerProducts.codiceCliente,
                    product.articoloId,
                    product.codiceArticolo,
                    product.descrizione,
                    product.categoriaId,
                    product.categoriaDescrizione,
                    product.quantita,
                    product.dataDocumento
                ]);
            }
        }

        await connection.commit();
        transactionStarted = false;
        const invoicedLineCount = payload.prodottiFatturatiPerCliente
            .reduce((count, customer) => count + customer.prodotti.length, 0);
        console.log(
            `[STORICO] Salvati ${payload.clienti.length} clienti, ${products.size} prodotti, ` +
            `${payload.attrezzature.length} attrezzature, ${payload.accessori.length} accessori, ` +
            `${payload.classiSottoclassi.length} classi/sottoclassi e ${invoicedLineCount} righe fattura.`
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
