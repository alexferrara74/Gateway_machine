import express from 'express';
import apiRoutes from './routes/api.js';

const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api/noleggi', apiRoutes);

export default app;
