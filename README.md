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
| `HOST` | Interfaccia di ascolto; vuoto = tutte, `127.0.0.1` = solo questo computer. |
| `SYNC_API_TOKEN` | Facoltativo ma consigliato. Se valorizzato, `POST /api/sincronizza` richiede `Authorization: Bearer <token>` (`/health` resta pubblico). Impostare lo stesso valore nel backend (`SYNC_API_TOKEN`), che lo inoltra. Senza token il servizio avvisa all'avvio. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connessione ERP; il database principale è `az1`. |
| `DB_NUOVO_HOST`, `DB_NUOVO_PORT`, `DB_NUOVO_USER`, `DB_NUOVO_PASSWORD`, `DB_NUOVO_NAME` | Connessione alla destinazione, normalmente `service`. |
| `SYNC_PRODOTTI_CATEGORIE_IDS` | ID `artclscid` delle categorie prodotto, separati da virgola. `SYNC_ANAG_IDS` resta accettato come alias. |
| `SYNC_ATTREZZATURE_CLASSI` | Codici classe (`clcod`) da includere, separati da virgola. |
| `SYNC_ATTREZZATURE_SOTTOCLASSI` | Coppie esatte `clcod:sccod`, separate da virgola. |
| `SYNC_ACCESSORI_SOTTOCLASSI` | Coppie `clcod:sccod` della selezione attrezzature che sono accessori: non entrano in `local_attrezzature` e hanno `is_accessorio=1`. |
| `SYNC_FATTURE_DA_ANNO` | Primo anno delle fatture da acquisire; predefinito `2011`. |
| `EXPORT_B2B_CATEGORIE_IDS` | ID `artclscid` delle categorie da esportare per il sito B2B, separati da virgola. Indipendente da `SYNC_PRODOTTI_CATEGORIE_IDS`. Senza, l'export risponde 503. |
| `EXPORT_B2B_LISTINO_ID` | `listini.llistid` del listino di vendita da cui leggere il prezzo (senza IVA). Senza, l'export risponde 503. |
| `EXPORT_B2B_CRON_ENABLED`, `EXPORT_B2B_CRON_SCHEDULE` | Generazione periodica di `prodotti.csv`; predefinito spento, ogni 3 ore (`0 */3 * * *`). Con il cron attivo la configurazione viene controllata all'avvio. |
| `EXPORT_B2B_OUTPUT_DIR` | Cartella locale dove salvare il file (facoltativa se usi l'SFTP). |
| `EXPORT_B2B_SFTP_HOST`, `_PORT`, `_USER`, `_PASSWORD` o `_PRIVATE_KEY_PATH`, `_REMOTE_DIR`, `_HOST_FINGERPRINT` | Consegna del file sul sito via SFTP. `_REMOTE_DIR` è relativa alla home (`sana-private/data/import`). L'impronta del server è obbligatoria. |
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

## Test

```powershell
npm test
```

Sette test girano sempre (configurazione, DTO, API/token). Altri cinque verificano la **persistenza su un database MySQL reale** (idempotenza, rollback, righe manuali mai cancellate) e sono disattivati finché non si indica un database dedicato il cui nome **termina in `_test`** (il test cancella le sue tabelle e le ricrea dalla V1 di `../servizi_pilot_BE`):

```powershell
$env:IT_DB_HOST='127.0.0.1'; $env:IT_DB_PORT='3306'; $env:IT_DB_USER='root'; $env:IT_DB_PASSWORD='...'; $env:IT_DB_NAME='service_test'
npm test
```

Con un nome diverso da `*_test` i test restano saltati: non possono toccare il database vero.

## Migrazione database

> **Lo schema ora è gestito da Flyway nel backend** (`servizi_pilot_BE/src/main/resources/db/migration`). Gli script in `migrations/` sono storici (già consolidati nella V1) e non vanno eseguiti su un database nuovo. Le nuove modifiche allo schema si aggiungono come migrazioni Flyway nel backend.


Prima dell'avvio, fare un backup e applicare una sola volta, in ordine,
[`migrations/001_catalogo_prodotti.sql`](./migrations/001_catalogo_prodotti.sql)
e [`migrations/002_classi_sottoclassi.sql`](./migrations/002_classi_sottoclassi.sql)
al database `service`. Le migrazioni creano il catalogo locale, collegano le
attrezzature ai prodotti ERP, aggiungono a `storia_prodotti` le chiavi per
evitare doppioni e creano il riferimento locale di classi/sottoclassi. Non
vengono eseguite automaticamente.

## Pulizia dei doppioni storici

Dopo il primo sync con chiavi ERP, le righe di `storia_prodotti` scritte dal vecchio sync (senza chiave ERP) risultano duplicate. `scripts/deduplica_storia_prodotti.sql` mostra l'anteprima ed elimina solo le righe gemelle esatte; per default termina con `ROLLBACK` (sostituirlo con `COMMIT` dopo aver verificato i numeri; fare prima un backup). Dettagli in `../docs/ANALISI_DATI_ERP.md`.

## Avvio manuale da Postman

Inviare una richiesta `POST` a `http://localhost:3000/api/sincronizza` senza body.
Se `SYNC_API_TOKEN` è impostato aggiungere l'header `Authorization: Bearer <token>`;
altrimenti l'endpoint è aperto: esporlo solo su localhost o su una rete interna
fidata, perché chi può raggiungerlo può avviare una sincronizzazione.

PowerShell:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/sincronizza `
  -Headers @{ Authorization = "Bearer $env:SYNC_API_TOKEN" } `
  -ContentType "application/json"
```

La risposta contiene il numero di clienti, prodotti, attrezzature e righe
fattura elaborate, non i dati anagrafici.

## Export prodotti per il sito B2B

`GET /api/export/prodotti` restituisce il file `prodotti.csv` (UTF-8, separatore `;`) con gli articoli delle
categorie `EXPORT_B2B_CATEGORIE_IDS`, nel tracciato dell'import del sito Sana Breakfast
(`sanabreakfasthotel/docs/tracciato-prodotti.md`). Legge solo dall'ERP: **il file è la risposta, non viene scritto
su nessun database né su disco.** Richiede il token come gli altri endpoint (`SYNC_API_TOKEN`).

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/export/prodotti `
  -Headers @{ Authorization = "Bearer $env:SYNC_API_TOKEN" } -OutFile prodotti.csv
```

| Colonna | Origine ERP |
| --- | --- |
| `codice` | `articoli.artcod` (maiuscolo) |
| `descrizione` | `articoli.artdescr` |
| `categoria` | `classisottoclassi.clscdescr` |
| `um` | `articoli.artumven` (minuscolo) |
| `prezzo` | `listini.lprz1` della riga con `lid` più alto per l'articolo nel listino `EXPORT_B2B_LISTINO_ID`, **senza IVA** |
| `iva` | `comunejazz.codiva.ivaaliq` tramite `articoli.artcodivaid` |
| `giacenza` | registro movimenti dell'anno in corso (`corpodocmag<anno>`): giacenze iniziali + carichi − scarichi, segno dalla causale (`caumag.cmtipo`), ordini esclusi; **0 per gli articoli senza movimenti** (vedi limiti) |
| `attivo` | 0 se `articoli.artbloccato = 1`, altrimenti 1 |

Il sito scarta l'intero file se una riga non è valida, quindi gli articoli **senza prezzo nel listino, senza IVA
intera, con codice non valido o doppio** restano fuori dal file: il loro numero è nell'header `X-Righe-Escluse`
(esportate: `X-Righe-Esportate`) e i primi 20 con il motivo sono nel log del servizio. Se non resta nessun articolo
la risposta è 422; se manca la configurazione, 503.

### Generazione automatica ogni 3 ore

Con `EXPORT_B2B_CRON_ENABLED=true` il servizio genera il file ogni 3 ore (`EXPORT_B2B_CRON_SCHEDULE`) e lo
consegna alle destinazioni configurate:

- **Cartella locale** (`EXPORT_B2B_OUTPUT_DIR`): scrive `prodotti.csv.part` e lo rinomina in `prodotti.csv`.
- **Sito via SFTP** (`EXPORT_B2B_SFTP_*`): carica `prodotti.csv.part` nella cartella `data/import` del sito e lo
  rinomina, così lo script di import del sito non legge mai un file a metà. Il server è riconosciuto dall'impronta
  (`EXPORT_B2B_SFTP_HOST_FINGERPRINT`), senza la quale il servizio non parte.

Se l'ERP non risponde o il caricamento fallisce, il job scrive l'errore nel log e riprova al giro successivo: sul
sito resta l'ultimo catalogo importato. Per provare la consegna senza aspettare il cron:
`POST /api/export/prodotti/consegna` (stesso token degli altri endpoint, nessun body).

Il servizio deve restare acceso (o avviato come servizio/attività pianificata di Windows) perché il cron giri.

**Limiti noti:**

- **Giacenza.** L'ERP non ha una tabella di giacenze con dati (`giacenze_storico`, `depgiac`, `inventario` sono vuote): la giacenza
  si ricostruisce dai movimenti dell'anno (giacenza iniziale + acquisti + resi da cliente − vendite, omaggi, resi a
  fornitore, scarichi interni e trasferimenti). Ha un valore solo per gli articoli con movimenti nell'anno (circa 200 su
  1.014): per gli altri esce 0 e il sito mostra "disponibilità su richiesta". **Non è stata riconciliata con una
  giacenza reale**: i lotti, che per 196 articoli sono l'unico altro dato, non coincidono (64 su 196). Prima di fidarsene,
  confrontare a mano alcuni articoli con la schermata di giacenza del gestionale.
- **Articoli esclusi (31 nell'ultima prova).** Sono senza prezzo nel listino scelto: 8 hanno la descrizione `ND*`, uno è
  la riga di intestazione `Codice Articolo`, gli altri non risultano venduti nel 2026. Il motivo di ciascuno è nel log.
- Mancano `foto` e `multiplo`: l'ERP non li ha, il sito usa il segnaposto e il multiplo 1.
- Il listino è scelto per ID e il prezzo si considera senza IVA perché `artflagiva = 0` su tutti gli articoli:
  confermare con chi usa il gestionale.

## Anteprima interfaccia

La UI dimostrativa resta disponibile con `npm run ui` su
`http://localhost:4173`. Usa dati di esempio locali al browser e non è collegata
alla sincronizzazione ERP.
