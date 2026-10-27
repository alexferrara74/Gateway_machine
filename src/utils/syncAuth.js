import { timingSafeEqual } from 'node:crypto';

function isSyncAuthorized(authorizationHeader, expectedToken) {
    if (!authorizationHeader || !expectedToken) return false;

    const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader);
    if (!match) return false;

    const supplied = Buffer.from(match[1]);
    const expected = Buffer.from(expectedToken);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export { isSyncAuthorized };
