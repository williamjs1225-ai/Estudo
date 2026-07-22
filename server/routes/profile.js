/**
 * routes/profile.js
 * -----------------------------------------------------------------------
 * Alimenta a tela "Perfil" (tela 11): foto, nome, objetivos, metas,
 * preferências.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const supabase = require('../services/supabaseClient');

const router = express.Router();

/** GET /api/profile/:userId */
router.get('/:userId', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.params.userId)
    .single();

  if (error) return res.status(404).json({ error: 'Perfil não encontrado.' });
  res.json(data);
});

/** PATCH /api/profile/:userId — atualiza campos do perfil (nome, meta diária, foto, etc). */
router.patch('/:userId', async (req, res) => {
  const allowedFields = ['name', 'photo_url', 'goal_daily_words', 'goals', 'preferences'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.userId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
