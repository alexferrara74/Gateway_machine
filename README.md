# Sincronizzazione ERP → Servizi_Pilot

Il microservizio sincronizza:

- tutti i clienti ERP;
- tutti gli articoli nelle categorie configurate;
- le attrezzature definite da classi o sottoclassi ERP;
- i prodotti presenti nelle fatture cliente, associati ai clienti per codice ERP.

Non sincronizza noleggi o DDT. Le fatture servono esclusivamente per associare
i prodotti acquistati ai clienti; il catalogo viene popolato anche per articoli
non presenti in documenti.

## Requisiti e avvio

- Node.js 20 o superiore.
- Utente ERP in sola lettura sui database `az1` e `comunejazz`.
- Utente con scrittura sul database di destinazione `service`.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

Il controllo `GET http://localhost:3000/health` verifica che il servizio sia
attivo.

## Configurazione

| Variabile | Descrizione |
| --- | --- |
| `PORT` | Porta HTTP; predefinita `3000`. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connessione ERP; il database principale è `az1`. |
| `DB_NUOVO_HOST`, `DB_NUOVO_PORT`, `DB_NUOVO_USER`, `DB_NUOVO_PASSWORD`, `DB_NUOVO_NAME` | Connessione alla destinazione, normalmente `service`. |
| `SYNC_PRODOTTI_CATEGORIE_IDS` | ID `artclscid` delle categorie prodotto, separati da virgola. `SYNC_ANAG_IDS` resta accettato come alias. |
| `SYNC_ATTREZZATURE_CLASSI` | Codici classe (`clcod`) da includere, separati da virgola. |
| `SYNC_ATTREZZATURE_SOTTOCLASSI` | Coppie esatte `clcod:sccod`, separate da virgola. |
| `SYNC_ACCESSORI_SOTTOCLASSI` | Coppie `clcod:sccod` della selezione attrezzature che sono accessori: non entrano in `local_attrezzature` e hanno `is_accessorio=1`. |
| `SYNC_FATTURE_DA_ANNO` | Primo anno delle fatture da acquisire; predefinito `2011`. |
| `CRON_ENABLED`, `CRON_SCHEDULE` | Scheduler automatico; predefinito ogni giorno alle 02:00. |

Non inserire `.env` nel controllo versione. I dump SQL in `dupm/` sono esclusi
dal versionamento.

## Dati sincronizzati

- **Clienti:** anagrafiche contrassegnate come clienti (`anaggestc = 'S'`) e
  lette dalla tabella anagrafica `comunejazz.anagr`, senza aggiunte ricavate
  dalle fatture. Il codice cliente usa `anagclicod` e, se vuoto, ripiega sul
  codice anagrafica `anagcod`.
- **Prodotti:** articoli (`articoli`) nelle categorie
  `SYNC_PRODOTTI_CATEGORIE_IDS`, indipendentemente dalla presenza di documenti.
- **Attrezzature:** articoli ERP selezionati dalle classi/sottoclassi configurate.
  Sono registrati nel catalogo prodotti locale e collegati a
  `local_attrezzature`.
- **Classi e sottoclassi:** l'intera tabella ERP `classisottoclassi` viene
  aggiornata a ogni sincronizzazione in `local_classi_sottoclassi`, senza filtri
  di selezione attrezzature.
- **Prodotti fatturati:** query distinta sulle tabelle annuali ERP, filtrata
  automaticamente sulle fatture intestate a clienti (fatture ordinarie,
  differite, accompagnatorie e XAD; le proforma e i DDT sono esclusi) e sulle
  categorie configurate per gli articoli identificati. Le righe fattura senza
  articolo ERP ma con descrizione vengono conservate come voci testuali, senza
  codice articolo o categoria. Le righe vengono raggruppate per codice cliente
  ERP e salvate in `storia_prodotti`. Non serve configurare manualmente i tipi
  documento fattura.

La sincronizzazione aggiorna i record esistenti in modo idempotente e persiste
i dati in una transazione.

## Migrazione database

Prima dell'avvio, fare un backup e applicare una sola volta, in ordine,
[`migrations/001_catalogo_prodotti.sql`](./migrations/001_catalogo_prodotti.sql)
e [`migrations/002_classi_sottoclassi.sql`](./migrations/002_classi_sottoclassi.sql)
al database `service`. Le migrazioni creano il catalogo locale, collegano le
attrezzature ai prodotti ERP, aggiungono a `storia_prodotti` le chiavi per
evitare doppioni e creano il riferimento locale di classi/sottoclassi. Non
vengono eseguite automaticamente.

## Avvio manuale da Postman

Inviare una richiesta `POST` a `http://localhost:3000/api/sincronizza` senza
header `Authorization` e senza body. L'endpoint non richiede token; esporlo
solo su localhost o su una rete interna fidata, perché chi può raggiungerlo può
avviare una sincronizzazione.

PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/sincronizza `
  -ContentType "application/json"
```

La risposta contiene il numero di clienti, prodotti, attrezzature e righe
fattura elaborate, non i dati anagrafici.

## Anteprima interfaccia

La UI dimostrativa resta disponibile con `npm run ui` su
`http://localhost:4173`. Usa dati di esempio locali al browser e non è collegata
alla sincronizzazione ERP.
