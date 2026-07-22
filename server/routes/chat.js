/**
 * routes/chat.js
 * -----------------------------------------------------------------------
 * Alimenta a tela "IA Coach" (tela 5): chat livre, correção de textos
 * colados, explicações de regras, simulação de redação/entrevista.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const { complete } = require('../services/aiProvider');

const router = express.Router();

const COACH_SYSTEM_PROMPT = `Você é um coach de escrita e português brasileiro, paciente e didático.
Converse naturalmente, corrija erros quando pedido, explique regras com exemplos,
e proponha exercícios ou desafios quando fizer sentido.`;

/** POST /api/chat — recebe o histórico da conversa e retorna a próxima resposta da IA. */
router.post('/', async (req, res) => {
  const { history } = req.body; // [{ role: 'user'|'assistant', content }]
  if (!Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'Campo "history" (array) é obrigatório.' });
  }

  try {
    const reply = await complete([
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      ...history,
    ]);
    res.json({ role: 'assistant', content: reply });

    // TODO(fase 2): persistir a conversa em Supabase (tabela `conversations`)
  } catch (err) {
    console.error('[chat] erro:', err.message);
    res.status(502).json({ error: 'Falha ao consultar o coach de IA.' });
  }
});

module.exports = router;
