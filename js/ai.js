/**
 * ai.js
 * -----------------------------------------------------------------------
 * Ponte entre o front-end e a IA, em 3 camadas, cada uma como fallback
 * da anterior:
 *
 *   1) Chamada DIRETA do navegador ao provedor (Groq/OpenAI/Gemini),
 *      usando a chave que você mesmo configura na tela Perfil. Só faz
 *      sentido porque este é um PWA de uso pessoal — a chave fica salva
 *      apenas no localStorage do seu navegador e nunca é enviada a
 *      nenhum servidor além do provedor de IA escolhido. Não hospede
 *      este app publicamente para outras pessoas usarem com sua chave
 *      configurada: qualquer um com acesso ao site consegue lê-la pelo
 *      DevTools.
 *   2) Se não houver chave configurada (ou a chamada direta falhar,
 *      ex: CORS/rede), tenta o backend em /server (ver /server/routes) —
 *      útil se você optar por rodar o backend em vez de expor a chave.
 *   3) Se nada estiver disponível, cai numa resposta simulada, pra o
 *      app continuar funcionável offline/demo.
 * -----------------------------------------------------------------------
 */

const ScriptaAI = (() => {
  const API_BASE = '/api';

  // ---- Camada 1: chamada direta ao provedor, com a chave do usuário ----

  function getAIConfig() {
    return ScriptaStorage.getAIConfig();
  }

  function stripCodeFence(text) {
    return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  async function directGroq(messages, { temperature = 0.6, maxTokens = 800 } = {}, apiKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature, max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`Groq respondeu ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async function directOpenAI(messages, { temperature = 0.6, maxTokens = 800 } = {}, apiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature, max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`OpenAI respondeu ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async function directGemini(messages, { temperature = 0.6 } = {}, apiKey) {
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }),
      }
    );
    if (!res.ok) throw new Error(`Gemini respondeu ${res.status}`);
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  async function directComplete(messages, options = {}) {
    const { provider, apiKey } = getAIConfig();
    if (!apiKey) throw new Error('Nenhuma chave de IA configurada');
    if (provider === 'groq') return directGroq(messages, options, apiKey);
    if (provider === 'openai') return directOpenAI(messages, options, apiKey);
    if (provider === 'gemini') return directGemini(messages, options, apiKey);
    throw new Error(`Provedor desconhecido: ${provider}`);
  }

  /** Usado pelo botão "Testar conexão" na tela Perfil — não cai para mock. */
  async function testConnection() {
    const reply = await directComplete(
      [{ role: 'user', content: 'Responda apenas "ok".' }],
      { temperature: 0, maxTokens: 10 }
    );
    return reply.trim();
  }

  // ---- Camada 2: backend próprio (ver /server) ----

  async function callBackend(path, payload) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Backend respondeu ${res.status}`);
    return res.json();
  }

  /** Tenta direta -> backend -> mock, nessa ordem, sem travar se alguma falhar. */
  async function tryTiers({ direct, backend, mock }) {
    const { apiKey } = getAIConfig();
    if (apiKey) {
      try {
        return await direct();
      } catch (err) {
        console.warn('[ScriptaAI] chamada direta falhou, tentando backend:', err.message);
      }
    }
    try {
      return await backend();
    } catch (err) {
      console.warn('[ScriptaAI] backend indisponível, usando resposta simulada:', err.message);
    }
    return typeof mock === 'function' ? mock() : mock;
  }

  // ---- Camada 3: respostas simuladas ----

  const MOCK_TIPS = [
    'você tem repetido bastante a palavra "coisa" — que tal explorar sinônimos como "elemento" ou "aspecto"?',
    'suas frases estão ficando longas demais — dividir em duas melhora a clareza.',
    'ótimo uso de conectivos hoje! isso deixa o texto mais coeso.',
    'experimente variar o início das frases — muitas começam com "o" ou "a".',
  ];

  const EXERCISE_LABELS = {
    ortografia: 'Ortografia',
    gramatica: 'Gramática',
    concordancia: 'Concordância',
    pontuacao: 'Pontuação',
    sinonimos: 'Sinônimos',
    antonimos: 'Antônimos',
    vocabulario: 'Vocabulário',
    interpretacao: 'Interpretação',
    completar_frases: 'Completar frases',
    corrigir_erros: 'Corrigir erros',
  };

  const MOCK_EXERCISES = {
    ortografia: [
      { pergunta: 'Qual grafia está correta?', opcoes: ['Excessão', 'Exceção', 'Esceção', 'Exceção'], resposta: 'Exceção', explicacao: '"Exceção" se escreve com "x" e "ç", sem duplicar o "s".' },
    ],
    gramatica: [
      { pergunta: 'Complete: "Fazem dois anos que ___ aqui."', opcoes: ['moro', 'moramos', 'moras', 'more'], resposta: 'moro', explicacao: '"Fazer" indicando tempo é impessoal, mas o verbo da oração principal concorda com o sujeito oculto (eu): "moro".' },
    ],
    concordancia: [
      { pergunta: 'Qual frase está correta?', opcoes: ['Fazem dois meses que não vejo ela', 'Faz dois meses que não a vejo', 'Fazem dois mês que não vejo ela', 'Faz dois meses que não vejo elas'], resposta: 'Faz dois meses que não a vejo', explicacao: '"Fazer" indicando tempo decorrido é impessoal: fica sempre no singular.' },
    ],
    pontuacao: [
      { pergunta: 'Onde falta vírgula? "Antes de sair verifique as portas."', opcoes: ['Depois de "Antes"', 'Depois de "sair"', 'Depois de "verifique"', 'Não falta vírgula'], resposta: 'Depois de "sair"', explicacao: 'Orações adverbiais deslocadas para o início da frase pedem vírgula: "Antes de sair, verifique as portas."' },
    ],
    sinonimos: [
      { pergunta: 'Sinônimo de "efêmero":', opcoes: ['Eterno', 'Passageiro', 'Intenso', 'Distante'], resposta: 'Passageiro', explicacao: '"Efêmero" significa que dura pouco — mesmo sentido de "passageiro".' },
    ],
    antonimos: [
      { pergunta: 'Antônimo de "escasso":', opcoes: ['Raro', 'Abundante', 'Pequeno', 'Fraco'], resposta: 'Abundante', explicacao: '"Escasso" (pouco, insuficiente) se opõe a "abundante" (fartura).' },
    ],
    vocabulario: [
      { pergunta: 'O que significa "perspicaz"?', opcoes: ['Distraído', 'Que percebe com facilidade', 'Teimoso', 'Silencioso'], resposta: 'Que percebe com facilidade', explicacao: '"Perspicaz" descreve quem tem percepção aguçada, sagacidade.' },
    ],
    interpretacao: [
      { pergunta: '"Embora estivesse cansado, terminou o projeto." O que a oração sugere?', opcoes: ['Ele desistiu por causa do cansaço', 'O cansaço não o impediu de terminar', 'Ele nunca fica cansado', 'O projeto não foi terminado'], resposta: 'O cansaço não o impediu de terminar', explicacao: '"Embora" introduz uma ideia de contraste/concessão: apesar do cansaço, ele terminou.' },
    ],
    completar_frases: [
      { pergunta: 'Complete: "Se eu ___ mais tempo, teria viajado."', opcoes: ['tivesse', 'tenho', 'tive', 'terei'], resposta: 'tivesse', explicacao: 'Condição hipotética no passado pede pretérito imperfeito do subjuntivo: "se eu tivesse".' },
    ],
    corrigir_erros: [
      { pergunta: 'Qual frase está gramaticalmente correta?', opcoes: ['Houveram muitos problemas', 'Houve muitos problemas', 'Houveram muito problema', 'Houve muitos problema'], resposta: 'Houve muitos problemas', explicacao: '"Haver" no sentido de "existir" é impessoal — nunca vai para o plural.' },
    ],
  };

  const MOCK_READINGS = [
    {
      titulo: 'O valor da paciência',
      texto: 'Numa manhã como outra qualquer, um velho jardineiro plantou uma semente e não voltou a vê-la por semanas. Vizinhos perguntavam por que ele não desistia de um pedaço de terra que parecia não dar em nada. Ele respondia sempre da mesma forma: "as coisas boas raramente aparecem no primeiro dia". Meses depois, a árvore que nasceu daquela semente dava sombra para toda a rua — e ninguém mais perguntou sobre paciência.',
      perguntas: [
        { pergunta: 'O que o jardineiro valorizava?', opcoes: ['Pressa', 'Paciência', 'Sorte', 'Dinheiro'], resposta: 'Paciência' },
        { pergunta: 'O que a árvore representa no texto?', opcoes: ['Um erro', 'Resultado do esforço contínuo', 'Um acidente', 'Uma decoração'], resposta: 'Resultado do esforço contínuo' },
      ],
    },
    {
      titulo: 'Tecnologia e silêncio',
      texto: 'Vivemos cercados de notificações, mas raramente paramos para notar o quanto o silêncio ficou raro. Especialistas em produtividade sugerem blocos diários sem telas — não para rejeitar a tecnologia, mas para lembrar a mente como pensar sem interrupções. Pequenas pausas, dizem eles, tornam o restante do dia mais claro e as decisões mais firmes.',
      perguntas: [
        { pergunta: 'Qual é a sugestão dos especialistas?', opcoes: ['Usar mais notificações', 'Blocos diários sem telas', 'Trabalhar à noite', 'Ignorar a tecnologia para sempre'], resposta: 'Blocos diários sem telas' },
      ],
    },
  ];

  return {
    testConnection,
    exerciseLabels: EXERCISE_LABELS,

    // Helpers internos expostos pro games-content.js reaproveitar a mesma
    // lógica de "tenta chave direta -> backend -> mock", sem duplicar.
    _tryTiers: tryTiers,
    _directComplete: directComplete,
    _stripCodeFence: stripCodeFence,
    _callBackend: callBackend,

    /** Sugestão diária mostrada no card de IA da Home. */
    async getDailyTip() {
      return tryTiers({
        direct: async () => {
          const text = await directComplete(
            [{ role: 'system', content: 'Dê uma dica curta (1 frase) de escrita em português, tom encorajador.' }, { role: 'user', content: 'Gere uma dica para hoje.' }],
            { temperature: 0.9, maxTokens: 80 }
          );
          return { tip: text.trim() };
        },
        backend: () => callBackend('/correction/tip', {}),
        mock: () => ({ tip: MOCK_TIPS[Math.floor(Math.random() * MOCK_TIPS.length)] }),
      });
    },

    /** Análise completa de um texto (tela Escrita -> "Analisar com IA"). */
    async analyzeText(text) {
      return tryTiers({
        direct: async () => {
          const systemPrompt = `Você é um professor de português especialista em escrita. Avalie o texto do usuário e responda SOMENTE em JSON, sem markdown, neste formato exato:
{"score": 0-100, "label": "...", "description": "...", "metrics": {"errosCorrigidos": 0, "melhoriasEstilo": 0, "palavrasAvancadas": 0, "coerencia": 0-100, "clareza": 0-100, "originalidade": 0-100}}`;
          const raw = await directComplete(
            [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
            { temperature: 0.3 }
          );
          return JSON.parse(stripCodeFence(raw));
        },
        backend: () => callBackend('/correction', { text }),
        mock: () => {
          const words = text.trim().split(/\s+/).filter(Boolean);
          const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
          const score = Math.min(98, 70 + Math.round(Math.random() * 20));
          return {
            score,
            label: score >= 90 ? 'Excelente!' : score >= 75 ? 'Muito bom!' : 'Continue praticando',
            description: 'Seu texto está claro, coerente e bem estruturado.',
            metrics: {
              errosCorrigidos: Math.max(0, Math.round(words.length / 60)),
              melhoriasEstilo: Math.max(0, Math.round(sentences.length / 2)),
              palavrasAvancadas: Math.max(0, Math.round(words.length / 40)),
              coerencia: Math.min(99, 80 + Math.round(Math.random() * 15)),
              clareza: Math.min(99, 78 + Math.round(Math.random() * 15)),
              originalidade: Math.min(99, 75 + Math.round(Math.random() * 15)),
            },
          };
        },
      });
    },

    /** Próxima resposta do IA Coach dado o histórico da conversa. */
    async chatReply(history) {
      return tryTiers({
        direct: async () => {
          const systemPrompt = 'Você é um coach de escrita e português brasileiro, paciente e didático. Converse naturalmente, corrija erros quando pedido, explique regras com exemplos, e proponha exercícios ou desafios quando fizer sentido.';
          const text = await directComplete([{ role: 'system', content: systemPrompt }, ...history]);
          return { role: 'assistant', content: text };
        },
        backend: () => callBackend('/chat', { history }),
        mock: () => {
          const lastUser = [...history].reverse().find((m) => m.role === 'user');
          const msg = (lastUser && lastUser.content || '').toLowerCase();
          let reply;
          if (msg.includes('corrig') || msg.includes('revis')) {
            reply = 'Claro! Envie o texto que deseja que eu revise, ou cole aqui mesmo que eu já devolvo a versão corrigida com as mudanças destacadas.';
          } else if (msg.includes('sinôn') || msg.includes('sinonimo')) {
            reply = 'Me diz qual palavra você quer trocar que eu sugiro algumas opções com nuances diferentes de sentido.';
          } else {
            reply = 'Boa pergunta! Me conta um pouco mais sobre o que você está escrevendo que eu te ajudo a destravar as próximas frases.';
          }
          return { role: 'assistant', content: reply };
        },
      });
    },

    /** Gera um exercício de um tipo/nível específicos (tela Exercícios). */
    async generateExercise(type, level = 1) {
      return tryTiers({
        direct: async () => {
          const systemPrompt = `Gere um exercício de "${EXERCISE_LABELS[type] || type}" em português, nível de dificuldade ${level} de 5 (1=fácil, 5=difícil). Responda SOMENTE em JSON, sem markdown, neste formato exato:
{"pergunta": "...", "opcoes": ["...", "...", "...", "..."], "resposta": "...", "explicacao": "..."}`;
          const raw = await directComplete(
            [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Gere o exercício.' }],
            { temperature: 0.8 }
          );
          return JSON.parse(stripCodeFence(raw));
        },
        backend: () => callBackend('/exercises/generate', { type, level }),
        mock: () => {
          const pool = MOCK_EXERCISES[type] || MOCK_EXERCISES.gramatica;
          return pool[Math.floor(Math.random() * pool.length)];
        },
      });
    },

    /** Próximo texto curto de leitura + perguntas de interpretação. */
    async getReadingText() {
      return tryTiers({
        direct: async () => {
          const systemPrompt = `Escreva um texto curto original em português (150-250 palavras) seguido de 3 perguntas de interpretação de múltipla escolha. Responda SOMENTE em JSON, sem markdown, neste formato exato:
{"titulo": "...", "texto": "...", "perguntas": [{"pergunta": "...", "opcoes": ["...", "...", "...", "..."], "resposta": "..."}]}`;
          const raw = await directComplete(
            [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Gere o texto.' }],
            { temperature: 0.85, maxTokens: 900 }
          );
          return JSON.parse(stripCodeFence(raw));
        },
        backend: async () => {
          const res = await fetch(`${API_BASE}/reading/next`);
          if (!res.ok) throw new Error('offline');
          return res.json();
        },
        mock: () => MOCK_READINGS[Math.floor(Math.random() * MOCK_READINGS.length)],
      });
    },
  };
})();
