CREATE TABLE local_classi_sottoclassi (
    categoria_id INT NOT NULL,
    classe_codice CHAR(10) NOT NULL DEFAULT '',
    sottoclasse_codice CHAR(10) NOT NULL DEFAULT '',
    descrizione CHAR(50) NOT NULL DEFAULT '',
    tipo INT NULL DEFAULT 0,
    aggiornato_il TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (categoria_id),
    UNIQUE KEY uq_local_classi_sottoclassi_codici
        (classe_codice, sottoclasse_codice),
    KEY idx_local_classi_sottoclassi_classe (classe_codice)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
