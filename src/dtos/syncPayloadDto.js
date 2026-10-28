function mapProduct(product) {
    return {
        id: product.articolo_id ?? product.artid ?? null,
        codice: product.codice_articolo ?? product.artcod ?? '',
        descrizione: product.descrizione ?? product.artdescr ?? '',
        categoriaId: product.categoria_id ?? product.artclscid ?? null,
        categoriaDescrizione: product.categoria_descrizione ?? '',
        classeCodice: product.classe_codice ?? product.clcod ?? '',
        sottoclasseCodice: product.sottoclasse_codice ?? product.sccod ?? ''
    };
}

function mapInvoicedProduct(line) {
    return {
        annoErp: line.anno_erp,
        idRigaErp: line.id_riga_erp,
        idTestataErp: line.id_testata_erp,
        numeroDocumento: line.numero_documento,
        tipoDocumento: line.tipo_documento,
        dataDocumento: line.data_documento,
        articoloId: line.articolo_id,
        codiceArticolo: line.codice_articolo,
        descrizione: line.descrizione,
        categoriaId: line.categoria_id,
        categoriaDescrizione: line.categoria_descrizione ?? '',
        quantita: line.quantita
    };
}

export default class SyncPayloadDto {
    constructor({
        clienti = [],
        prodotti = [],
        attrezzature = [],
        accessori = [],
        classiSottoclassi = [],
        prodottiFatturati = []
    } = {}) {
        this.timestampSync = new Date().toISOString();
        this.clienti = clienti.map(cliente => ({
            id: cliente.anagid ?? cliente.id,
            codice: cliente.codice_cliente ?? cliente.anagclicod ?? '',
            codiceAnagrafica: cliente.anagcod ?? '',
            ragioneSociale: cliente.anagragsoc ?? '',
            nome: cliente.anagnome ?? '',
            cognome: cliente.anagcognome ?? '',
            telefono: cliente.anagcellulare ?? '',
            email: cliente.anagemailpec ?? '',
            partitaIva: cliente.anagpiva ?? '',
            codiceFiscale: cliente.anagcodfisc ?? ''
        }));
        this.prodotti = prodotti.map(mapProduct);
        this.attrezzature = attrezzature.map(product => ({
            ...mapProduct(product),
            marca: product.marca ?? '',
            modello: product.modello ?? ''
        }));
        this.accessori = accessori.map(mapProduct);
        this.classiSottoclassi = classiSottoclassi.map(category => ({
            id: category.categoria_id ?? category.clscid ?? null,
            classeCodice: category.classe_codice ?? category.clcod ?? '',
            sottoclasseCodice: category.sottoclasse_codice ?? category.sccod ?? '',
            descrizione: category.descrizione ?? category.clscdescr ?? '',
            tipo: category.tipo ?? category.cltipo ?? 0
        }));

        const prodottiPerCliente = new Map();
        for (const row of prodottiFatturati) {
            const codiceCliente = row.codice_cliente?.trim();
            if (!codiceCliente) {
                throw new Error(
                    `La riga fattura ${row.id_riga_erp} non ha un codice cliente ERP.`
                );
            }

            if (!prodottiPerCliente.has(codiceCliente)) {
                prodottiPerCliente.set(codiceCliente, {
                    codiceCliente,
                    clienteId: row.cliente_id,
                    ragioneSociale: row.ragione_sociale ?? '',
                    prodotti: []
                });
            }
            prodottiPerCliente.get(codiceCliente).prodotti.push(mapInvoicedProduct(row));
        }
        this.prodottiFatturatiPerCliente = [...prodottiPerCliente.values()];
    }
}
