ALTER TABLE storia_noleggi
    MODIFY COLUMN doc_id INT NOT NULL AUTO_INCREMENT,
    ADD COLUMN erp_anno SMALLINT UNSIGNED NULL,
    ADD COLUMN erp_riga_id INT NULL,
    ADD COLUMN erp_testata_id INT NULL,
    ADD COLUMN numero_ddt INT NULL,
    ADD UNIQUE KEY uq_storia_noleggi_erp_riga (erp_anno, erp_riga_id);

ALTER TABLE storia_prodotti
    ADD COLUMN erp_anno SMALLINT UNSIGNED NULL,
    ADD COLUMN erp_riga_id INT NULL,
    ADD UNIQUE KEY uq_storia_prodotti_erp_riga (erp_anno, erp_riga_id);

ALTER TABLE interventi
    DROP FOREIGN KEY interventi_ibfk_2;

ALTER TABLE local_attrezzature
    MODIFY COLUMN matricola VARCHAR(255) NULL;

ALTER TABLE interventi
    MODIFY COLUMN matricola_attrezzatura VARCHAR(255) NOT NULL,
    ADD CONSTRAINT interventi_ibfk_2
        FOREIGN KEY (matricola_attrezzatura)
        REFERENCES local_attrezzature (matricola)
        ON DELETE CASCADE;
