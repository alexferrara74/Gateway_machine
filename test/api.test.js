import assert from 'node:assert/strict';
import { after, test } from 'node:test';

const { default: app } = await import('../src/app.js');
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
