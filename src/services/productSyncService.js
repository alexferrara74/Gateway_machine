import db from '../config/db.js';
import { config } from '../config/config.js';
import SyncPayloadDto from '../dtos/syncPayloadDto.js';

const invoiceDocumentTypes = [1, 3, 4, 21, 23];

function buildEquipmentFilter() {
    const conditions = [];
    const params = [];

    if (config.equipmentClassCodes.length > 0) {
        conditions.push('csc.clcod IN (?)');
        params.push(config.equipmentClassCodes);
    }

    for (const subclass of config.equipmentSubclasses) {
        conditions.push('(csc.clcod = ? AND csc.sccod = ?)');
        params.push(subclass.classCode, subclass.subclassCode);
    }

    return {
        sql: conditions.join(' OR '),
        params
    };
}

async function loadProductGroups() {
    const productIds = config.productCategoryIds;
    const equipmentFilter = buildEquipmentFilter();
    const select = `
        SELECT
            art.artid AS articolo_id,
            art.artcod AS codice_articolo,
            art.artdescr AS descrizione,
            art.artclscid AS categoria_id,
            csc.clscdescr AS categoria_descrizione,
            csc.clcod AS classe_codice,
            csc.sccod AS sottoclasse_codice
        FROM articoli art
        LEFT JOIN classisottoclassi csc ON csc.clscid = art.artclscid
    `;

    const [products] = productIds.length > 0
        ? await db.query(
            `${select} WHERE art.artclscid IN (?) ORDER BY art.artcod`,
            [productIds]
        )
        : [[]];

    const [equipment] = equipmentFilter.sql
        ? await db.query(
            `${select} WHERE ${equipmentFilter.sql} ORDER BY art.artcod`,
            equipmentFilter.params
        )
        : [[]];

    const isAccessory = row => config.accessorySubclasses.some(
        subclass => subclass.classCode === String(row.classe_codice).trim() &&
            subclass.subclassCode === String(row.sottoclasse_codice).trim()
    );

    return {
        prodotti: products,
        attrezzature: equipment.filter(row => !isAccessory(row)),
        accessori: equipment.filter(isAccessory)
    };
}

async function loadClassSubclasses() {
    const [categories] = await db.query(`
        SELECT
            clscid AS categoria_id,
            clcod AS classe_codice,
            sccod AS sottoclasse_codice,
            clscdescr AS descrizione,
            cltipo AS tipo
        FROM classisottoclassi
        ORDER BY clcod, sccod, clscid
    `);
    return categories;
}

async function loadInvoiceLines(articleCondition, articleParams) {
    const currentYear = new Date().getFullYear();
    const invoicedProducts = [];

    for (let year = config.invoiceStartYear; year <= currentYear; year++) {
        const headerTable = `testatadoc${year}${year}`;
        const rowsTable = `corpodocmag${year}${year}`;
        const movementsTable = `movimentidoc${year}${year}`;
        try {
            const [rows] = await db.query(`
                SELECT
                    ? AS anno_erp,
                    r.corpomagid AS id_riga_erp,
                    r.corpomagmovdocid AS id_testata_erp,
                    r.corpomagnumdoc AS numero_documento,
                    doc.docdescr AS tipo_documento,
                    r.corpomagdtdoc AS data_documento,
                    t.testaanagid AS cliente_id,
                    COALESCE(NULLIF(TRIM(a.anagclicod), ''), a.anagcod) AS codice_cliente,
                    a.anagragsoc AS ragione_sociale,
                    art.artid AS articolo_id,
                    art.artcod AS codice_articolo,
                    CASE
                        WHEN art.artid IS NULL THEN NULLIF(TRIM(r.corpomagdescr), '')
                        ELSE art.artdescr
                    END AS descrizione,
                    art.artclscid AS categoria_id,
                    csc.clscdescr AS categoria_descrizione,
                    csc.clcod AS classe_codice,
                    r.corpomagqta AS quantita
                FROM ${headerTable} t
                JOIN ${rowsTable} r ON t.testamovdocid = r.corpomagmovdocid
                JOIN ${movementsTable} m ON m.movdocid = t.testamovdocid
                JOIN documenti doc ON doc.docid = m.movdocdocumid
                JOIN comunejazz.anagr a
                    ON a.anagid = t.testaanagid
                LEFT JOIN articoli art ON art.artid = r.corpomagartid
                LEFT JOIN classisottoclassi csc ON csc.clscid = art.artclscid
                WHERE t.testatipocf = 1
                  AND doc.doctipo IN (?)
                  AND LOWER(doc.docdescr) LIKE '%fattura%'
                  AND LOWER(doc.docdescr) NOT LIKE '%proforma%'
                  AND (${articleCondition})
                  AND COALESCE(NULLIF(TRIM(a.anagclicod), ''), a.anagcod) <> ''
            `, [year, invoiceDocumentTypes, ...articleParams]);
            invoicedProducts.push(...rows);
        } catch (error) {
            const missingTable = error.code === 'ER_NO_SUCH_TABLE' &&
                [headerTable, rowsTable, movementsTable]
                    .some(table => error.message.includes(table));
            if (!missingTable) throw error;
            console.warn(`[SYNC] Tabelle documentali per ${year} non presenti; anno saltato.`);
        }
    }

    return invoicedProducts;
}

function loadInvoicedProducts() {
    return loadInvoiceLines(
        `art.artid IS NULL AND NULLIF(TRIM(r.corpomagdescr), '') IS NOT NULL
                      OR art.artclscid IN (?)`,
        [config.productCategoryIds]
    );
}

export async function eseguiSincronizzazione() {
    if (config.productCategoryIds.length === 0) {
        throw new Error('Configurare SYNC_PRODOTTI_CATEGORIE_IDS con gli ID categoria ERP.');
    }
    if (config.equipmentClassCodes.length === 0 && config.equipmentSubclasses.length === 0) {
        throw new Error(
            'Configurare SYNC_ATTREZZATURE_CLASSI o SYNC_ATTREZZATURE_SOTTOCLASSI.'
        );
    }
    const [clientRows, productGroups, classiSottoclassi, invoicedProducts] =
        await Promise.all([
            db.query(`
                SELECT
                    anagid,
                    COALESCE(NULLIF(TRIM(anagclicod), ''), anagcod) AS codice_cliente,
                    anagcod,
                    anagragsoc,
                    anagnome,
                    anagcognome,
                    anagcellulare,
                    anagemailpec,
                    anagpiva,
                    anagcodfisc
                FROM comunejazz.anagr
                WHERE anaggestc = 'S'
                ORDER BY codice_cliente
            `),
            loadProductGroups(),
            loadClassSubclasses(),
            loadInvoicedProducts()
        ]);

    const payload = new SyncPayloadDto({
        clienti: clientRows[0],
        prodotti: productGroups.prodotti,
        attrezzature: productGroups.attrezzature,
        accessori: productGroups.accessori,
        classiSottoclassi,
        prodottiFatturati: invoicedProducts
    });

    return {
        success: true,
        statistiche: {
            clienti: payload.clienti.length,
            prodottiCatalogo: payload.prodotti.length,
            attrezzature: payload.attrezzature.length,
            accessori: payload.accessori.length,
            classiSottoclassi: payload.classiSottoclassi.length,
            righeFattura: invoicedProducts.length,
            clientiConProdottiFatturati: payload.prodottiFatturatiPerCliente.length
        },
        payload
    };
}
