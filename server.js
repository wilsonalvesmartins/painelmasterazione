import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000; // Rodando na porta 4000 para não conflitar com a 3000

// Servir os arquivos estáticos do React
app.use(express.static(path.join(__dirname, 'dist')));

// Rota coringa
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Painel Master da Azione rodando na porta ${PORT}`);
});
