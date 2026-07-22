/**
 * routes/statistics.js
 * -----------------------------------------------------------------------
 * Alimenta a tela "Estatísticas" (tela 10) e o "Plano Inteligente"
 * (tela 8): sequência, palavras aprendidas, textos escritos, tempo
 * estudado, exercícios concluídos, precisão, evolução semanal/mensal.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const supabase = require('../services/supabaseClient');
const { complete } = require('../services/aiProvider');

const router = express.Router();

/** GET /api/statistics/:userId — retorna os números agregados do usuário. */
router.get('/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('statistics')
    .select('*')
    .eq('user_id', req.params.userId)
    .single();

  if (error) return res.status(404).json({ error: 'Estatísticas não encontradas.' });
  res.json(data);
});

/** POST /api/statistics/:userId/plan — gera (ou regenera) o plano inteligente com base no desempenho. */
router.post('/:userId/plan', async (req, res) => {
  const { data: stats, error } = await supabase
    .from('statistics')
    .select('*')
    .eq('user_id', req.params.userId)
    .single();

  if (error) return res.status(404).json({ error: 'Estatísticas não encontradas para gerar o plano.' });

  try {
    const raw = await complete([
      {
        role: 'system',
        content: `Com base nestas estatísticas de um estudante de português: ${JSON.stringify(stats)},
crie um plano de evolução com metas diárias, semanais e um cronograma de 7 dias.
Responda SOMENTE em JSON: { "metaDiaria": "...", "metaSemanal": "...", "cronograma": [{ "dia": "...", "foco": "..." }] }`,
      },
      { role: 'user', content: 'Gere o plano.' },
    ], { temperature: 0.5 });

    res.json(JSON.parse(raw));
  } catch (err) {
    console.error('[statistics/plan] erro:', err.message);
    res.status(502).json({ error: 'Falha ao gerar plano inteligente.' });
  }
});

module.exports = router;
