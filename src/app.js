import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { config } from './config/config.js';
import apiRoutes from './routes/api.js';

const app = express();
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

function hasValidToken(request) {
    const [scheme, token = ''] = (request.get('authorization') || '').split(' ');
    if (scheme !== 'Bearer') return false;
    // Confronto sugli hash: stessa lunghezza e tempo costante.
    const digest = value => createHash('sha256').update(value).digest();
    return timingSafeEqual(digest(token), digest(config.syncApiToken));
}

app.use('/api', (req, res, next) => {
    if (!config.syncApiToken || hasValidToken(req)) return next();
    return res.status(401).json({ status: 'error', message: 'Token non valido o mancante.' });
});
app.use(express.json());
app.use('/api', apiRoutes);

export default app;
