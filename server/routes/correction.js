/**
 * routes/correction.js
 * -----------------------------------------------------------------------
 * Endpoints de correção de texto (gramática, ortografia, pontuação,
 * clareza) usados pelo Editor Inteligente (tela 4) e pelo card de
 * sugestão da IA na Home.
 *
 * Esta rota está totalmente implementada e serve de PADRÃO para as
 * demais (chat, exercises, reading, vocabulary) — copie esta estrutura.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const { complete } = require('../services/aiProvider');

const router = express.Router();

const SYSTEM_PROMPT = `Você é um professor de português especialista em escrita.
Analise o texto do usuário e responda SOMENTE em JSON, com este formato:
{
  "errors": [{ "trecho": "...", "tipo": "gramática|ortografia|pontuação|clareza", "sugestao": "...", "explicacao": "..." }],
  "palavrasRepetidas": ["..."],
  "notaClareza": 0-10
}`;

/** POST /api/correction — analisa um texto completo e retorna erros/sugestões. */
router.post('/', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Campo "text" é obrigatório.' });
  }

  try {
    const raw = await complete([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ], { temperature: 0.3 });

    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    console.error('[correction] erro:', err.message);
    res.status(502).json({ error: 'Falha ao consultar a IA de correção.' });
  }
});

/** POST /api/correction/tip — sugestão curta e motivacional para a Home. */
router.post('/tip', async (req, res) => {
  try {
    const raw = await complete([
      { role: 'system', content: 'Dê uma dica curta (1 frase) de escrita em português, tom encorajador.' },
      { role: 'user', content: 'Gere uma dica para hoje.' },
    ], { temperature: 0.9, maxTokens: 80 });

    res.json({ tip: raw.trim() });
  } catch (err) {
    console.error('[correction/tip] erro:', err.message);
    res.status(502).json({ error: 'Falha ao gerar dica.' });
  }
});

module.exports = router;
