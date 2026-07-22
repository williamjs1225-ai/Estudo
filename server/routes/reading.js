/**
 * routes/reading.js
 * -----------------------------------------------------------------------
 * Alimenta a tela "Leitura" (tela 7): textos curtos (artigos, crônicas,
 * notícias, histórias, motivacionais) seguidos de perguntas de
 * interpretação, resumo e nota de compreensão.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const { complete } = require('../services/aiProvider');

const router = express.Router();

/** GET /api/reading/next — retorna o próximo texto curto + perguntas. */
router.get('/next', async (req, res) => {
  const { genre = 'cronica' } = req.query;

  try {
    const raw = await complete([
      {
        role: 'system',
        content: `Escreva um texto curto original em português (gênero: ${genre}, 150-250 palavras)
seguido de 3 perguntas de interpretação. Responda SOMENTE em JSON:
{ "titulo": "...", "texto": "...", "perguntas": [{ "pergunta": "...", "opcoes": ["..."], "resposta": "..." }] }`,
      },
      { role: 'user', content: 'Gere o texto.' },
    ], { temperature: 0.85, maxTokens: 900 });

    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('[reading/next] erro:', err.message);
    res.status(502).json({ error: 'Falha ao gerar texto de leitura.' });
  }
});

/** POST /api/reading/score — calcula a nota de compreensão a partir das respostas. */
router.post('/score', (req, res) => {
  const { answers, correctAnswers } = req.body; // arrays paralelos
  if (!Array.isArray(answers) || !Array.isArray(correctAnswers)) {
    return res.status(400).json({ error: 'Campos "answers" e "correctAnswers" (arrays) são obrigatórios.' });
  }
  const hits = answers.filter((a, i) => a === correctAnswers[i]).length;
  const score = Math.round((hits / correctAnswers.length) * 100);
  res.json({ score, hits, total: correctAnswers.length });
  // TODO(fase 2): persistir resultado em Supabase (tabela `statistics`)
});

module.exports = router;
