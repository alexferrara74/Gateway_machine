import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, '..', 'public');
const port = Number(process.env.UI_PORT) || 4173;

app.use(express.static(publicDirectory));
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDirectory, 'index.html'));
});

app.listen(port, () => {
  console.log(`Anteprima UI disponibile su http://localhost:${port}`);
});
