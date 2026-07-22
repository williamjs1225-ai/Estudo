/**
 * server.js
 * -----------------------------------------------------------------------
 * Ponto de entrada do backend do Scripta. Roda `npm install && npm run dev`
 * dentro de /server para subir localmente (padrão: http://localhost:3000).
 *
 * Todas as chaves de API (IA + Supabase) vivem SOMENTE aqui, via .env
 * (ver .env.example) — o front-end nunca as vê.
 * -----------------------------------------------------------------------
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const chatRoutes = require('./routes/chat');
const correctionRoutes = require('./routes/correction');
const exercisesRoutes = require('./routes/exercises');
const readingRoutes = require('./routes/reading');
const vocabularyRoutes = require('./routes/vocabulary');
const profileRoutes = require('./routes/profile');
const statisticsRoutes = require('./routes/statistics');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/chat', chatRoutes);
app.use('/api/correction', correctionRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/reading', readingRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', provider: process.env.AI_PROVIDER }));

// Handler de erro genérico — evita vazar stack traces para o cliente.
app.use((err, req, res, next) => {
  console.error('[server] erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scripta backend rodando em http://localhost:${PORT} (IA: ${process.env.AI_PROVIDER || 'groq'})`);
});
