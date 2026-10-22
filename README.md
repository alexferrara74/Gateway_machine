# Integrazione ERP → API

Servizio Node.js che legge i DDT di noleggio da un database MySQL/MariaDB e li
invia con una richiesta `POST` JSON all'API configurata.

## Requisiti e avvio

- Node.js 20 o superiore.
- Accesso di rete dal server al database ERP e all'API destinataria.
- Un utente MySQL in sola lettura sulle tabelle interrogate.

```powershell
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Compilare `.env` con i parametri reali (se esiste già, integrare le variabili di
`.env.example` senza sovrascriverlo) e avviare il servizio:

```powershell
npm start
```

Il server segnala in modo esplicito le variabili mancanti o non valide. Il
controllo `/health` è disponibile su `GET http://localhost:3000/health`.

## Variabili di configurazione

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `PORT` | No | Porta HTTP; predefinita `3000`. |
| `DB_HOST`, `DB_PORT` | Sì / No | Host MySQL e porta; la porta predefinita è `3306`. |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sì | Credenziali e nome del database ERP. |
| `DB_POOL_SIZE` | No | Numero massimo di connessioni; predefinito `5`. |
| `CATEGORIA_ATTREZZATURE_ID` | Sì | ID categoria usato per filtrare gli articoli. |
| `API_URL` | Sì | URL completo dell'endpoint che riceve il `POST`. |
| `API_TOKEN` | Sì | Token inviato nell'header `Authorization: Bearer`. |
| `API_TIMEOUT_MS` | No | Timeout HTTP in millisecondi; predefinito `30000`. |
| `SYNC_TRIGGER_TOKEN` | Sì | Token Bearer richiesto dall'endpoint di avvio manuale. |
| `MESI_STORICO` | No | Finestra storica in mesi; predefinita `2`. |
| `CRON_ENABLED` | No | Abilita il job automatico; predefinito `true`. |
| `CRON_SCHEDULE` | No | Espressione cron; predefinita `0 2 * * *` (ogni giorno alle 02:00). |

Non inserire il file `.env` nel controllo versione: è escluso da `.gitignore`.

## Estrazione e invio

La query predefinita legge `ddt_testate`, `ddt_righe` e `articoli`, seleziona
i documenti `DDT-NOLEGGIO` degli ultimi `MESI_STORICO` mesi e filtra per
`articoli.artcategid`. Se le tabelle o le colonne dell'ERP hanno nomi diversi,
adattare `QUERY_DDT_NOLEGGIO` in `src/services/syncService.js`.

Il corpo inviato all'API ha questa forma:

```json
{
  "source": "erp-ddt-noleggio",
  "count": 1,
  "periodStart": "2026-08-09",
  "records": [
    {
      "id_ddt": 123,
      "numero_ddt": "DDT-123",
      "data_doc": "2026-08-10",
      "cliente_id": 456,
      "articolo_id": 789,
      "quantita": 1,
      "prezzo": 12.5
    }
  ]
}
```

L'endpoint deve accettare `Content-Type: application/json` e il token Bearer.
La logica di persistenza/idempotenza dei record appartiene all'API destinataria.

## Avvio manuale

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:3000/api/noleggi/riarmo-sync `
  -Headers @{ Authorization = "Bearer $env:SYNC_TRIGGER_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"mesi":2}'
```

Il campo `mesi` è opzionale e deve essere compreso tra 1 e 120.
# Gateway_machine
