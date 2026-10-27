import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSyncAuthorized } from '../src/utils/syncAuth.js';

test('accepts only the configured bearer token', () => {
    assert.equal(isSyncAuthorized('Bearer correct-token', 'correct-token'), true);
    assert.equal(isSyncAuthorized('Bearer wrong-token', 'correct-token'), false);
    assert.equal(isSyncAuthorized('correct-token', 'correct-token'), false);
    assert.equal(isSyncAuthorized(undefined, 'correct-token'), false);
    assert.equal(isSyncAuthorized('Bearer correct-token', undefined), false);
});
