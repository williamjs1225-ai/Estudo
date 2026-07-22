/**
 * supabaseClient.js
 * -----------------------------------------------------------------------
 * Cliente único do Supabase, usando a service role key (privilégios de
 * servidor). NUNCA exponha essa chave no front-end — apenas o backend
 * deve importar este módulo.
 *
 * Tabelas sugeridas (ver README.md para o schema completo):
 *   users, texts, conversations, statistics, exercises, goals,
 *   vocabulary, settings
 * -----------------------------------------------------------------------
 */

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados — ' +
    'rotas que dependem de banco de dados vão falhar até o .env ser preenchido.'
  );
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

module.exports = supabase;
