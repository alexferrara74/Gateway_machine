import assert from 'node:assert/strict';
import { after, test } from 'node:test';

const { default: app } = await import('../src/app.js');
const { config } = await import('../src/config/config.js');
const server = app.listen(0);
const baseUrl = await new Promise(resolve => {
    server.once('listening', () => {
        resolve(`http://127.0.0.1:${server.address().port}`);
    });
});

after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
}));

test('allows manual sync requests without a token and rejects unexpected payloads', async () => {
    const unexpectedBody = await fetch(`${baseUrl}/api/sincronizza`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesi: 2 })
    });
    assert.equal(unexpectedBody.status, 400);
    assert.equal((await unexpectedBody.json()).message, 'Questo endpoint non accetta un body.');
});

async function withToken(token, callback) {
    const previous = config.syncApiToken;
    config.syncApiToken = token;
    try {
        await callback();
    } finally {
        config.syncApiToken = previous;
    }
}

const post = (headers = {}, body = { mesi: 2 }) => fetch(`${baseUrl}/api/sincronizza`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
});

test('rejects requests without a valid bearer token when a token is configured', async () => {
    await withToken('segreto', async () => {
        assert.equal((await post()).status, 401);
        assert.equal((await post({ Authorization: 'Bearer sbagliato' })).status, 401);
        assert.equal((await post({ Authorization: 'Basic segreto' })).status, 401);
        assert.equal((await post({ Authorization: 'Bearer' })).status, 401);
    });
});

test('lets a request with the right token reach the endpoint', async () => {
    await withToken('segreto', async () => {
        // Il body non vuoto viene rifiutato dall'endpoint: prova che l'autenticazione è passata
        // senza avviare una sincronizzazione.
        const response = await post({ Authorization: 'Bearer segreto' });
        assert.equal(response.status, 400);
    });
});

test('keeps the health check public even when a token is configured', async () => {
    await withToken('segreto', async () => {
        assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
    });
});
