/**
 * routes/vocabulary.js
 * -----------------------------------------------------------------------
 * Alimenta a tela "Vocabulário" (tela 9): novas palavras, sinônimos,
 * significados, exemplos e revisões via repetição espaçada (SM-2 simples).
 * -----------------------------------------------------------------------
 */

const express = require('express');
const supabase = require('../services/supabaseClient');
const { complete } = require('../services/aiProvider');

const router = express.Router();

/** GET /api/vocabulary — lista palavras salvas do usuário, ordenadas por próxima revisão. */
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'Parâmetro "userId" é obrigatório.' });

  const { data, error } = await supabase
    .from('vocabulary')
    .select('*')
    .eq('user_id', userId)
    .order('next_review_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/** POST /api/vocabulary — adiciona uma nova palavra (com definição gerada por IA se necessário). */
router.post('/', async (req, res) => {
  const { userId, word, definition } = req.body;
  if (!userId || !word) return res.status(400).json({ error: 'Campos "userId" e "word" são obrigatórios.' });

  let finalDefinition = definition;
  if (!finalDefinition) {
    try {
      finalDefinition = await complete([
        { role: 'system', content: 'Defina a palavra em português com 1 significado, 1 sinônimo e 1 frase de exemplo. Responda em texto simples.' },
        { role: 'user', content: word },
      ], { temperature: 0.4, maxTokens: 200 });
    } catch (err) {
      console.error('[vocabulary] falha ao gerar definição:', err.message);
    }
  }

  const { data, error } = await supabase.from('vocabulary').insert({
    user_id: userId,
    word,
    definition: finalDefinition,
    next_review_at: new Date().toISOString(),
    interval_days: 1,
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/** POST /api/vocabulary/:id/review — registra revisão e recalcula próxima data (SM-2 simplificado). */
router.post('/:id/review', async (req, res) => {
  const { id } = req.params;
  const { remembered } = req.body; // boolean

  const { data: word, error: fetchErr } = await supabase.from('vocabulary').select('*').eq('id', id).single();
  if (fetchErr) return res.status(404).json({ error: 'Palavra não encontrada.' });

  const newInterval = remembered ? Math.round(word.interval_days * 2.2) : 1;
  const nextReview = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('vocabulary')
    .update({ interval_days: newInterval, next_review_at: nextReview })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
