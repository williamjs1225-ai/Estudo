/**
 * routes/exercises.js
 * -----------------------------------------------------------------------
 * Alimenta a tela "Exercícios" (tela 6): gera exercícios personalizados
 * de ortografia, gramática, concordância, pontuação, sinônimos/antônimos,
 * vocabulário, interpretação, escrita criativa, completar frases, corrigir erros.
 *
 * A dificuldade deve aumentar com o desempenho do usuário — por isso
 * o body espera `level` e `history` de acertos, vindos de /api/statistics.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const { complete } = require('../services/aiProvider');

const router = express.Router();

/** POST /api/exercises/generate — cria um novo exercício. */
router.post('/generate', async (req, res) => {
  const { type, level = 1 } = req.body;
  const validTypes = [
    'ortografia', 'gramatica', 'concordancia', 'pontuacao', 'sinonimos',
    'antonimos', 'vocabulario', 'interpretacao', 'escrita_criativa',
    'completar_frases', 'corrigir_erros',
  ];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Use um de: ${validTypes.join(', ')}` });
  }

  try {
    const raw = await complete([
      {
        role: 'system',
        content: `Gere um exercício de "${type}" em português, nível de dificuldade ${level} (1=fácil, 5=difícil).
Responda SOMENTE em JSON: { "pergunta": "...", "opcoes": ["..."] (se múltipla escolha), "resposta": "...", "explicacao": "..." }`,
      },
      { role: 'user', content: 'Gere o exercício.' },
    ], { temperature: 0.8 });

    res.json(JSON.parse(raw));
    // TODO(fase 2): salvar exercício + resposta em Supabase (tabela `exercises`)
  } catch (err) {
    console.error('[exercises/generate] erro:', err.message);
    res.status(502).json({ error: 'Falha ao gerar exercício.' });
  }
});

/** POST /api/exercises/check — avalia a resposta do usuário. */
router.post('/check', async (req, res) => {
  const { question, userAnswer, correctAnswer } = req.body;
  if (!question || userAnswer === undefined || !correctAnswer) {
    return res.status(400).json({ error: 'Campos "question", "userAnswer" e "correctAnswer" são obrigatórios.' });
  }
  // Checagem simples local; para respostas abertas (escrita criativa),
  // troque por uma chamada à IA avaliando qualitativamente.
  const isCorrect = String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
  res.json({ isCorrect });
});

module.exports = router;
