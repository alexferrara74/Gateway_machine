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
    SYNC_TRIGGER_TOKEN: 'test-trigger-token',
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

test('rejects a DDT type code longer than the ERP field', async () => {
    await withEnvironment(
        { ...requiredVariables, DDT_NOLEGGIO_TIPO: 'TOOLONG' },
        async () => {
            const { validateConfig } = await import('../src/config/config.js?invalid-ddt-type-test');
            assert.throws(validateConfig, /DDT_NOLEGGIO_TIPO/);
        }
    );
});
