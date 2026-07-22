/**
 * aiProvider.js
 * -----------------------------------------------------------------------
 * Abstração única sobre os três provedores de IA suportados. As rotas
 * (routes/*.js) nunca chamam OpenAI/Groq/Gemini diretamente — sempre
 * passam por `complete()`, que escolhe o provedor via AI_PROVIDER no .env.
 *
 * Isso deixa trivial trocar de provedor (ex: usar Groq por custo/latência
 * no dia a dia e OpenAI para tarefas mais complexas) sem tocar nas rotas.
 * -----------------------------------------------------------------------
 */

const PROVIDER = process.env.AI_PROVIDER || 'groq';

/**
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{ temperature?: number, maxTokens?: number }} options
 * @returns {Promise<string>} texto de resposta da IA
 */
async function complete(messages, options = {}) {
  switch (PROVIDER) {
    case 'groq':
      return completeWithGroq(messages, options);
    case 'openai':
      return completeWithOpenAI(messages, options);
    case 'gemini':
      return completeWithGemini(messages, options);
    default:
      throw new Error(`AI_PROVIDER desconhecido: ${PROVIDER}`);
  }
}

async function completeWithGroq(messages, { temperature = 0.6, maxTokens = 800 } = {}) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile', // ajuste para o modelo Groq desejado
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`Groq respondeu ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function completeWithOpenAI(messages, { temperature = 0.6, maxTokens = 800 } = {}) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // ajuste conforme necessidade/custo
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI respondeu ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

async function completeWithGemini(messages, { temperature = 0.6 } = {}) {
  // Gemini usa um formato de "contents" diferente do padrão OpenAI-like;
  // aqui fazemos uma conversão simples concatenando as mensagens.
  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini respondeu ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

module.exports = { complete };
