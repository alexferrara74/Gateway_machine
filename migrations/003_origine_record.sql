-- Distingue i record scritti dal sync ERP da quelli inseriti a mano dall'utente.
-- Il sync elimina solo righe con origine = 'ERP'; le altre non vengono mai toccate.

ALTER TABLE local_prodotti
    ADD COLUMN origine VARCHAR(10) NOT NULL DEFAULT 'MANUALE',
    ADD COLUMN is_accessorio TINYINT(1) NOT NULL DEFAULT 0;
-- Prima di questa migrazione solo il sync scriveva in local_prodotti.
UPDATE local_prodotti SET origine = 'ERP';

ALTER TABLE local_attrezzature
    ADD COLUMN origine VARCHAR(10) NOT NULL DEFAULT 'MANUALE';
UPDATE local_attrezzature SET origine = 'ERP' WHERE articolo_id IS NOT NULL;

ALTER TABLE storia_prodotti
    ADD COLUMN origine VARCHAR(10) NOT NULL DEFAULT 'MANUALE';
UPDATE storia_prodotti SET origine = 'ERP' WHERE erp_riga_id IS NOT NULL;

-- Righe del vecchio sync (senza chiave ERP) che ora esistono identiche con chiave ERP.
DELETE legacy FROM storia_prodotti legacy
JOIN storia_prodotti erp
    ON erp.erp_riga_id IS NOT NULL
   AND erp.cliente_id <=> legacy.cliente_id
   AND erp.articolo_id <=> legacy.articolo_id
   AND erp.data_doc <=> legacy.data_doc
   AND erp.quantita <=> legacy.quantita
WHERE legacy.erp_riga_id IS NULL;

ALTER TABLE storia_noleggi
    ADD COLUMN erp_anno SMALLINT UNSIGNED NULL,
    ADD COLUMN erp_riga_id INT NULL,
    ADD COLUMN codice_articolo VARCHAR(50) NULL,
    ADD COLUMN descrizione VARCHAR(255) NULL,
    ADD COLUMN origine VARCHAR(10) NOT NULL DEFAULT 'MANUALE',
    ADD UNIQUE KEY uq_storia_noleggi_erp_riga (erp_anno, erp_riga_id);
