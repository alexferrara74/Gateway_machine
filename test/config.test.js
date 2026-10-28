import assert from 'node:assert/strict';
import { test } from 'node:test';

const requiredVariables = {
    DB_HOST: '127.0.0.1',
    DB_USER: 'test-user',
    DB_PASSWORD: 'test-password',
    DB_NAME: 'test-database',
    DB_NUOVO_HOST: '127.0.0.1',
    DB_NUOVO_USER: 'service-user',
    DB_NUOVO_PASSWORD: 'service-password',
    DB_NUOVO_NAME: 'service',
    SYNC_PRODOTTI_CATEGORIE_IDS: '1,2',
    SYNC_ATTREZZATURE_CLASSI: 'MAC',
    SYNC_ATTREZZATURE_SOTTOCLASSI: 'MAC:01',
    CRON_ENABLED: 'false'
};

async function withEnvironment(overrides, callback) {
    const previous = new Map(
        Object.keys(overrides).map((key) => [key, process.env[key]])
    );
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }

    try {
        await callback();
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

test('accepts complete ERP and destination database settings', async () => {
    await withEnvironment(requiredVariables, async () => {
        const { validateConfig } = await import('../src/config/config.js?valid-test');
        assert.doesNotThrow(validateConfig);
    });
});

test('reports required settings that are missing', async () => {
    await withEnvironment(
        { ...requiredVariables, DB_HOST: '' },
        async () => {
            const { validateConfig } = await import('../src/config/config.js?missing-test');
            assert.throws(validateConfig, /DB_HOST/);
        }
    );
});

test('rejects malformed equipment subclass selectors', async () => {
    await withEnvironment(
        { ...requiredVariables, SYNC_ATTREZZATURE_SOTTOCLASSI: 'ONLY-CLASS' },
        async () => {
            await assert.rejects(
                import('../src/config/config.js?invalid-equipment-subclass-test'),
                /classe:sottoclasse/
            );
        }
    );
});
