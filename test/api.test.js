import assert from 'node:assert/strict';
import { after, test } from 'node:test';

process.env.SYNC_TRIGGER_TOKEN = 'route-test-token';
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

test('protects the manual sync endpoint and validates its period', async () => {
    const unauthorized = await fetch(`${baseUrl}/api/noleggi/riarmo-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesi: 0 })
    });
    assert.equal(unauthorized.status, 401);

    const invalidPeriod = await fetch(`${baseUrl}/api/noleggi/riarmo-sync`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer route-test-token',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mesi: 0 })
    });
    assert.equal(invalidPeriod.status, 400);
});
