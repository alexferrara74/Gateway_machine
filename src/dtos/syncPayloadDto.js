export default class SyncPayloadDto {
    constructor(noleggi = [], clienti = [], attrezzature = [], prodottiAcquistati = []) {
        this.timestampSync = new Date().toISOString();
        
        // 1. Dati di TUTTI i noleggi / DDT estratti
        this.noleggi = noleggi.map(n => ({
            idAbbonamento: n.doc_id || n.corpomagid || n.abbonid,
            tipoDocumento: n.sezionale || n.corpomagsufdoc || n.abbontipodoc || '',
            dataInizio: n.abbondatainiz || n.corpomagdtdoc || n.data_doc,
            dataFine: n.abbondatafine || null,
            clienteId: n.abboncliid || n.testaanagid || n.cliente_id,
            articoloId: n.abbonartid || n.corpomagartid || n.artid,
            matricola: n.abbonmatricola || n.corpomaglotto || '',
            quantita: n.quantita || n.corpomagqta || 1
        }));

        // 2. Anagrafica Clienti Completa
        this.clienti = clienti.map(c => ({
            id: c.id || c.cliid || c.anagid,
            codice: c.codice || c.clicod || c.anagcod || '',
            ragioneSociale: c.ragioneSociale || c.cliragsoc || c.anagragsoc || '',
            nome: c.nome || c.clinome || c.anagnome || '',
            cognome: c.cognome || c.clicognome || c.anagcognome || '',
            telefono: c.telefono || c.clitel || c.anagcellulare || '',
            email: c.email || c.cliemail || c.anagemailpec || '',
            partitaIva: c.partitaIva || c.clipiva || c.anagpiva || '',
            codiceFiscale: c.codiceFiscale || c.clicf || c.anagcodfisc || '',
            tipoListino: c.tipoListino || c.clitipolis || 0
        }));

        // 3. Attrezzature
        this.attrezzature = attrezzature.map(a => ({
            id: a.attrezid || a.id,
            matricola: a.attrezmatricola || a.matricola,
            modello: a.attrezmodello || a.modello || '',
            articoloId: a.attrezartid || a.articoloId,
            note: a.attreznote || a.descrizione || null
        }));

        // 4. Tutti gli Articoli / Prodotti acquistati
        this.prodottiAcquistati = prodottiAcquistati.map(p => ({
            clienteId: p.cliente_id || p.clienteId || p.testaanagid,
            articoloId: p.artid || p.articoloId,
            codiceArticolo: p.artcod || p.codiceArticolo || '',
            descrizione: p.artdescr || p.descrizione || '',
            descrizioneEstesa: p.artdescrestesa || p.descrizioneEstesa || null,
            categoriaId: p.categoria_id || p.artclscid || p.categoriaId || null,
            categoriaDescrizione: p.categoria_descrizione || p.categoriaDescrizione || '',
            quantita: p.quantita || p.corpomagqta || 0,
            dataDocumento: p.data_doc || p.dataDocumento
        }));
    }
}