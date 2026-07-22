/**
 * routes/auth.js
 * -----------------------------------------------------------------------
 * Autenticação (tela 2: Login/Criar conta/Esqueci a senha), delegando
 * para o Supabase Auth. O front-end (js/auth.js) hoje simula o login
 * localmente — troque `fakeLogin()` por chamadas a estas rotas quando
 * o Supabase estiver configurado no .env.
 * -----------------------------------------------------------------------
 */

const express = require('express');
const supabase = require('../services/supabaseClient');

const router = express.Router();

/** POST /api/auth/signup */
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json(data);
});

/** POST /api/auth/forgot-password */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });

  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'E-mail de recuperação enviado.' });
});

/** POST /api/auth/google — troca o token do OAuth do Google por uma sessão Supabase. */
router.post('/google', async (req, res) => {
  // TODO(fase 2): implementar fluxo OAuth completo (signInWithIdToken)
  res.status(501).json({ error: 'Login com Google ainda não implementado — configure o provider no Supabase Auth.' });
});

module.exports = router;
