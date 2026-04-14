import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Servir os arquivos estáticos do React
app.use(express.static(path.join(__dirname, 'dist')));

// Banco de Dados SQLite na VPS (Master)
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Erro ao conectar no banco SQLite: ", err);
    else console.log("SQLite conectado com sucesso na VPS Master!");
});

// Inicialização da Tabela
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS data_store (key TEXT PRIMARY KEY, value JSON)`);
});

// Rotas da API para Persistência
app.get('/api/data/:key', (req, res) => {
    db.get("SELECT value FROM data_store WHERE key = ?", [req.params.key], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.value) : null);
    });
});

app.post('/api/data/:key', (req, res) => {
    db.run(`INSERT OR REPLACE INTO data_store (key, value) VALUES (?, ?)`, 
    [req.params.key, JSON.stringify(req.body)], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Rota coringa
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Painel Master da Azione rodando na porta ${PORT}`);
});
