-- Deduplica di storia_prodotti dopo il primo sync con chiavi ERP.
--
-- Contesto: le righe scritte dal vecchio sync non hanno erp_anno/erp_riga_id e la migrazione 003
-- le marca origine = 'MANUALE'. Dopo il primo sync con chiavi, le stesse righe ERP vengono
-- inserite di nuovo e le statistiche contano due volte lo stesso acquisto.
--
-- Questo script elimina SOLO le righe "gemelle": senza chiave ERP e identiche (cliente, articolo,
-- data, quantita') a una riga ERP gia' presente. Non e' una migrazione e non viene eseguito da solo.
-- Le righe senza gemella (es. inserite a mano dall'operatore o prodotte con criteri diversi dal
-- vecchio sync) NON vengono toccate: vanno riviste a mano con la query al punto 1.
--
-- Uso: 1) fare un backup; 2) eseguire il file: per default termina con ROLLBACK, quindi mostra
-- solo i numeri; 3) se corretti, sostituire ROLLBACK con COMMIT e rieseguire.

-- 1) Anteprima
SELECT
    SUM(erp_riga_id IS NULL)                      AS righe_senza_chiave_erp,
    SUM(erp_riga_id IS NULL AND EXISTS (
        SELECT 1 FROM storia_prodotti e
        WHERE e.erp_riga_id IS NOT NULL
          AND e.cliente_id  <=> storia_prodotti.cliente_id
          AND e.articolo_id <=> storia_prodotti.articolo_id
          AND e.data_doc    <=> storia_prodotti.data_doc
          AND e.quantita    <=> storia_prodotti.quantita
    ))                                            AS di_cui_con_gemella_erp
FROM storia_prodotti;

-- 2) Pulizia (annullata di default)
START TRANSACTION;

DELETE legacy FROM storia_prodotti legacy
WHERE legacy.erp_riga_id IS NULL
  AND EXISTS (
      SELECT 1 FROM (SELECT cliente_id, articolo_id, data_doc, quantita
                     FROM storia_prodotti WHERE erp_riga_id IS NOT NULL) e
      WHERE e.cliente_id  <=> legacy.cliente_id
        AND e.articolo_id <=> legacy.articolo_id
        AND e.data_doc    <=> legacy.data_doc
        AND e.quantita    <=> legacy.quantita
  );

SELECT ROW_COUNT() AS righe_eliminate;

ROLLBACK; -- sostituire con COMMIT dopo aver verificato righe_eliminate
