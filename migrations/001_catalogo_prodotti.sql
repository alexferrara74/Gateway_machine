CREATE TABLE local_prodotti (
    articolo_id BIGINT NOT NULL,
    codice VARCHAR(50) NOT NULL,
    descrizione VARCHAR(255) NOT NULL,
    categoria_id INT NULL,
    categoria_descrizione VARCHAR(255) NULL,
    classe_codice VARCHAR(10) NULL,
    sottoclasse_codice VARCHAR(10) NULL,
    is_attrezzatura TINYINT(1) NOT NULL DEFAULT 0,
    aggiornato_il TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (articolo_id),
    KEY idx_local_prodotti_categoria (categoria_id),
    KEY idx_local_prodotti_attrezzatura (is_attrezzatura)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE local_attrezzature
    ADD COLUMN articolo_id BIGINT NULL,
    ADD UNIQUE KEY uq_local_attrezzature_articolo (articolo_id),
    ADD CONSTRAINT fk_local_attrezzature_prodotto
        FOREIGN KEY (articolo_id)
        REFERENCES local_prodotti (articolo_id)
        ON DELETE SET NULL;

ALTER TABLE storia_prodotti
    ADD COLUMN codice_cliente VARCHAR(11) NULL AFTER cliente_id,
    ADD COLUMN erp_anno SMALLINT UNSIGNED NULL,
    ADD COLUMN erp_riga_id INT NULL,
    ADD UNIQUE KEY uq_storia_prodotti_erp_riga (erp_anno, erp_riga_id);
