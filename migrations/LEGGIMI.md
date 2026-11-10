# Migrazioni storiche

Questi script sono già stati consolidati nella `V1__schema_iniziale.sql` del backend
(`../servizi_pilot_BE/src/main/resources/db/migration`), che ora è l'unico punto di verità dello schema
del database `service` (gestito da Flyway). **Non eseguirli su un database nuovo.**

Ordine in cui erano stati applicati, per chi deve riallineare un database parziale:
`001_catalogo_prodotti` → `002_classi_sottoclassi` → `003_origine_record` → `004_rimuovi_noleggi_erp`,
poi gli script `db/manual/20261102` e `20261103` del backend.

Nuove modifiche allo schema: aggiungere una `V<n>__descrizione.sql` nel backend.
`001_erp_sync_keys.sql` è un file vuoto non tracciato: si può eliminare.
