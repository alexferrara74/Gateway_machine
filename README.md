# Sincronizzazione ERP → Servizi_Pilot

Servizio Node.js che legge i DDT di noleggio e le righe prodotto dal database
ERP MySQL/MariaDB e li storicizza nel database `service` usato da Servizi_Pilot.
Il servizio non crea documenti nell'ERP: sincronizza quelli già registrati.

## Requisiti e avvio

- Node.js 20 o superiore.
- Accesso MySQL in sola lettura al database ERP e accesso in scrittura al
  database di destinazione `service`.
- Il tipo DDT dedicato ai noleggi deve essere configurato nell'ERP e il relativo
  codice deve essere inserito in `DDT_NOLEGGIO_TIPO`.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
npm start
```

Il controllo `GET http://localhost:3000/health` segnala che il servizio è attivo.
Se `DDT_NOLEGGIO_TIPO` non è ancora impostato, il server può avviarsi ma le
sincronizzazioni falliscono in modo esplicito senza leggere documenti non filtrati.

## Configurazione

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `PORT` | No | Porta HTTP; predefinita `3000`. |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sì | Connessione in sola lettura al database ERP. |
| `DB_PORT` | No | Porta ERP; predefinita `3306`. |
| `DB_POOL_SIZE` | No | Pool ERP; predefinito `5`. |
| `DB_NUOVO_HOST`, `DB_NUOVO_USER`, `DB_NUOVO_PASSWORD`, `DB_NUOVO_NAME` | Sì | Connessione al database di destinazione `service`. |
| `DB_NUOVO_PORT` | No | Porta destinazione; predefinita `3306`. |
| `DB_NUOVO_POOL_SIZE` | No | Pool destinazione; predefinito `10`. |
| `DDT_NOLEGGIO_TIPO` | Prima della sincronizzazione | Codice ERP del tipo DDT noleggio, confrontato con `corpomagdoctipo` (massimo 3 caratteri). |
| `SYNC_ANAG_IDS` | No | ID categoria articolo separati da virgola per lo storico dei prodotti/consumi. |
| `SYNC_TRIGGER_TOKEN` | Sì | Token Bearer richiesto dall'endpoint manuale. |
| `MESI_STORICO` | No | Finestra letta; predefinita `2`, valori da `1` a `120`. |
| `CRON_ENABLED` | No | Abilita la sincronizzazione pianificata; predefinito `true`. |
| `CRON_SCHEDULE` | No | Espressione cron; predefinita `0 2 * * *`. |

Non inserire `.env` nel controllo versione. `DB_USER` dovrebbe avere solo i
permessi di lettura sui database ERP; l'utente `DB_NUOVO_USER` necessita invece
dei permessi di scrittura sulle tabelle di destinazione.

## Schema destinazione e migrazione

Prima del primo avvio, applicare una sola volta
[`migrations/001_erp_sync_keys.sql`](./migrations/001_erp_sync_keys.sql) al
database `service`, dopo averne fatto un backup. La migrazione assegna ID locali
stabili ai noleggi, aggiunge chiavi idempotenti basate su anno e riga ERP e
allinea la lunghezza della matricola alle tabelle ERP.

Le righe già presenti in `storia_noleggi` e `storia_prodotti` non hanno l'anno e
l'ID della riga ERP; non possono essere associate automaticamente alle nuove
chiavi. Prima di attivare la sincronizzazione, valutare se conservarle come
storico legacy o bonificarle per evitare sovrapposizioni con la finestra
sincronizzata.

## Dati sincronizzati

Per ogni anno nella finestra, il servizio legge le coppie di tabelle
`testatadoc{anno}{anno}` e `corpodocmag{anno}{anno}`. I noleggi sono filtrati
per data e per `corpomagdoctipo = DDT_NOLEGGIO_TIPO`; il record di destinazione
conserva numero, sezionale, cliente, articolo, matricola e quantità.

Le righe prodotto nelle categorie di `SYNC_ANAG_IDS` vengono lette per lo
storico consumi e aggiornate in modo idempotente. Il servizio sincronizza inoltre
le anagrafiche dei clienti e le attrezzature trovate nei DDT. L'esecuzione
manuale e quella pianificata usano lo stesso flusso e scrivono in una singola
transazione sul database `service`.

## Avvio manuale

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/noleggi/riarmo-sync `
  -Headers @{ Authorization = "Bearer <SYNC_TRIGGER_TOKEN>" } `
  -ContentType "application/json" `
  -Body '{"mesi":2}'
```

Il campo `mesi` è opzionale e deve essere un intero tra 1 e 120. La risposta
contiene solo le statistiche, non i dati anagrafici sincronizzati.

## Anteprima interfaccia noleggi

È disponibile una UI dimostrativa per lo storico dei noleggi e la pianificazione
delle manutenzioni. Avviarla con:

```powershell
npm run ui
```

Aprire `http://localhost:4173`. La pagina usa dati di esempio, non è collegata
al gestionale o a un servizio API e salva le modifiche alle soglie e agli
interventi solo nel `localStorage` del browser. Per cambiare la porta usare
`UI_PORT`, ad esempio `$env:UI_PORT=4174; npm run ui`.
