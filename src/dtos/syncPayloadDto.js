export default class SyncPayloadDto {
    constructor(noleggi = [], clienti = [], attrezzature = [], prodottiAcquistati = []) {
        this.timestampSync = new Date().toISOString();

        this.noleggi = noleggi.map(n => ({
            annoErp: n.anno_erp ?? null,
            idRigaErp: n.id_riga_erp ?? n.corpomagid ?? null,
            idTestataErp: n.id_testata_erp ?? n.corpomagmovdocid ?? null,
            numeroDocumento: n.numero_documento ?? null,
            tipoDocumento: n.tipo_documento ?? '',
            sezionale: n.sezionale ?? n.corpomagsufdoc ?? '',
            dataInizio: n.data_doc ?? n.corpomagdtdoc ?? null,
            dataFine: n.abbondatafine || null,
            clienteId: n.cliente_id ?? n.testaanagid ?? null,
            articoloId: n.articolo_id ?? n.corpomagartid ?? null,
            matricola: n.matricola ?? n.corpomaglotto ?? '',
            quantita: n.quantita ?? n.corpomagqta ?? 1
        }));

        this.clienti = clienti.map(c => ({
            id: c.id ?? c.cliid ?? c.anagid ?? null,
            codice: c.codice ?? c.clicod ?? c.anagcod ?? '',
            ragioneSociale: c.ragioneSociale ?? c.cliragsoc ?? c.anagragsoc ?? '',
            nome: c.nome ?? c.clinome ?? c.anagnome ?? '',
            cognome: c.cognome ?? c.clicognome ?? c.anagcognome ?? '',
            telefono: c.telefono ?? c.clitel ?? c.anagcellulare ?? '',
            email: c.email ?? c.cliemail ?? c.anagemailpec ?? '',
            partitaIva: c.partitaIva ?? c.clipiva ?? c.anagpiva ?? '',
            codiceFiscale: c.codiceFiscale ?? c.clicf ?? c.anagcodfisc ?? '',
            tipoListino: c.tipoListino ?? c.clitipolis ?? 0
        }));

        this.attrezzature = attrezzature.map(a => ({
            id: a.attrezid ?? a.id ?? null,
            matricola: a.attrezmatricola ?? a.matricola ?? '',
            modello: a.attrezmodello ?? a.modello ?? '',
            articoloId: a.attrezartid ?? a.articoloId ?? null,
            note: a.attreznote ?? a.descrizione ?? null
        }));

        this.prodottiAcquistati = prodottiAcquistati.map(p => ({
            annoErp: p.anno_erp ?? null,
            idRigaErp: p.id_riga_erp ?? p.corpomagid ?? null,
            clienteId: p.cliente_id ?? p.clienteId ?? p.testaanagid ?? null,
            articoloId: p.artid ?? p.articoloId ?? null,
            codiceArticolo: p.artcod ?? p.codiceArticolo ?? '',
            descrizione: p.artdescr ?? p.descrizione ?? '',
            descrizioneEstesa: p.artdescrestesa ?? p.descrizioneEstesa ?? null,
            categoriaId: p.categoria_id ?? p.artclscid ?? p.categoriaId ?? null,
            categoriaDescrizione: p.categoria_descrizione ?? p.categoriaDescrizione ?? '',
            quantita: p.quantita ?? p.corpomagqta ?? 0,
            dataDocumento: p.data_doc ?? p.dataDocumento ?? null
        }));
    }
}