/**
 * games-content.js
 * -----------------------------------------------------------------------
 * Conteúdo dos 19 minijogos: cada função gera uma rodada normalizada
 * (mesma forma pros jogos do tipo "quiz" e mesma forma pros do tipo
 * "digitação"), tentando IA de verdade primeiro (se houver chave
 * configurada) e caindo num banco de conteúdo pronto quando não há.
 *
 * Formatos normalizados:
 *   Quiz:     { prompt, options: string[], correctAnswer, explanation }
 *   Digitação:{ prompt, correctAnswer, explanation, hints?: string[] }
 * -----------------------------------------------------------------------
 */

const ScriptaGamesContent = (() => {
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
  function byDifficulty(pool, difficulty) {
    const filtered = pool.filter((item) => item.difficulty === difficulty);
    return filtered.length ? filtered : pool;
  }

  /** Tenta gerar via IA (chave direta do usuário); sem chave, usa o mock. */
  async function generateViaAI({ systemPrompt, userPrompt = 'Gere agora.', mockPool, difficulty, temperature = 0.8 }) {
    return ScriptaAI._tryTiers({
      direct: async () => {
        const raw = await ScriptaAI._directComplete(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          { temperature }
        );
        return JSON.parse(ScriptaAI._stripCodeFence(raw));
      },
      backend: async () => { throw new Error('sem rota de backend pra jogos ainda'); },
      mock: () => pick(byDifficulty(mockPool, difficulty)),
    });
  }

  // =================== FAMÍLIA "QUIZ" (múltipla escolha) ===================

  const QUIZ_PROMPTS = {
    'complete-frase': 'Crie uma frase em português com uma lacuna "___" e 4 opções de palavra pra completar, sendo só uma correta. Nível de dificuldade: {difficulty}.',
    'sinonimos-antonimos': 'Escolha uma palavra em português e peça um sinônimo OU antônimo dela (decida aleatoriamente), com 4 opções sendo só uma correta. Diga no prompt se é sinônimo ou antônimo. Nível: {difficulty}.',
    'ortografia': 'Mostre 4 grafias parecidas de uma mesma palavra em português, sendo só uma correta ortograficamente. Nível: {difficulty}.',
    'porque': 'Crie uma frase em português com lacuna "___" que deva ser preenchida com "por que", "porque", "por quê" ou "porquê", com essas 4 opções. Nível: {difficulty}.',
    'mas-mais': 'Crie uma frase em português com lacuna "___" que deva ser preenchida com "mas" ou "mais", com essas 2 opções (repita uma opção incorreta parecida se precisar de 4 no total, tipo variações). Nível: {difficulty}.',
    'mau-mal': 'Crie uma frase em português com lacuna "___" que deva ser preenchida com "mau" ou "mal", com essas opções. Nível: {difficulty}.',
  };

  const QUIZ_JSON_FORMAT = '{"prompt": "...", "options": ["...","...","...","..."], "correctAnswer": "...", "explanation": "..."}';

  const QUIZ_MOCKS = {
    'complete-frase': [
      { difficulty: 'facil', prompt: 'Eu gosto muito de ___ frutas.', options: ['comer', 'comendo', 'comi', 'comerá'], correctAnswer: 'comer', explanation: '"Gostar de" pede o verbo no infinitivo: "comer".' },
      { difficulty: 'facil', prompt: 'Ela foi ___ escola de manhã.', options: ['à', 'há', 'a há', 'ah'], correctAnswer: 'à', explanation: 'Crase antes de palavra feminina que aceita "a": "à escola".' },
      { difficulty: 'medio', prompt: 'O relatório precisa ser entregue ___ sexta-feira.', options: ['até', 'ate', 'atê', 'athé'], correctAnswer: 'até', explanation: '"Até" indica prazo/limite, com acento agudo.' },
      { difficulty: 'dificil', prompt: 'Ainda que ele ___ cansado, terminou o projeto.', options: ['estivesse', 'estava', 'esteve', 'estará'], correctAnswer: 'estivesse', explanation: '"Ainda que" pede subjuntivo: "estivesse".' },
    ],
    'sinonimos-antonimos': [
      { difficulty: 'facil', prompt: 'Sinônimo de "feliz":', options: ['triste', 'contente', 'bravo', 'cansado'], correctAnswer: 'contente', explanation: '"Contente" tem o mesmo sentido de "feliz".' },
      { difficulty: 'facil', prompt: 'Antônimo de "grande":', options: ['enorme', 'imenso', 'pequeno', 'largo'], correctAnswer: 'pequeno', explanation: '"Pequeno" é o oposto de "grande".' },
      { difficulty: 'medio', prompt: 'Sinônimo de "perspicaz":', options: ['distraído', 'sagaz', 'lento', 'tímido'], correctAnswer: 'sagaz', explanation: '"Sagaz" e "perspicaz" indicam quem percebe as coisas com facilidade.' },
      { difficulty: 'dificil', prompt: 'Antônimo de "efêmero":', options: ['passageiro', 'breve', 'duradouro', 'rápido'], correctAnswer: 'duradouro', explanation: '"Efêmero" (dura pouco) se opõe a "duradouro" (dura muito).' },
    ],
    ortografia: [
      { difficulty: 'facil', prompt: 'Qual grafia está correta?', options: ['Exceção', 'Excessão', 'Esceção', 'Ecessão'], correctAnswer: 'Exceção', explanation: '"Exceção" tem "x" e um "ç" só.' },
      { difficulty: 'medio', prompt: 'Qual grafia está correta?', options: ['Beneficiente', 'Beneficente', 'Benefissente', 'Benefiscente'], correctAnswer: 'Beneficente', explanation: '"Beneficente" (que faz o bem) — cuidado pra não confundir com "beneficiente", que nem existe.' },
      { difficulty: 'dificil', prompt: 'Qual grafia está correta?', options: ['Previlégio', 'Privilégio', 'Previlegio', 'Privelégio'], correctAnswer: 'Privilégio', explanation: '"Privilégio" vem de "privi-", não "previ-".' },
    ],
    porque: [
      { difficulty: 'facil', prompt: 'Não fui à festa ___ estava doente.', options: ['porque', 'por que', 'por quê', 'porquê'], correctAnswer: 'porque', explanation: '"Porque" explica um motivo (junto, sem acento).' },
      { difficulty: 'medio', prompt: '___ você não me ligou ontem?', options: ['Por que', 'Porque', 'Por quê', 'Porquê'], correctAnswer: 'Por que', explanation: 'Início de pergunta usa "por que" separado.' },
      { difficulty: 'dificil', prompt: 'Não entendi o ___ da sua decisão.', options: ['porquê', 'porque', 'por que', 'por quê'], correctAnswer: 'porquê', explanation: '"O porquê" é substantivo (o motivo), junto e com acento.' },
    ],
    'mas-mais': [
      { difficulty: 'facil', prompt: 'Quero ___ um pedaço de bolo.', options: ['mais', 'mas', 'máis', 'más'], correctAnswer: 'mais', explanation: '"Mais" indica quantidade adicional.' },
      { difficulty: 'medio', prompt: 'Estudei bastante, ___ não passei na prova.', options: ['mas', 'mais', 'máis', 'más'], correctAnswer: 'mas', explanation: '"Mas" tem sentido de oposição (=porém).' },
    ],
    'mau-mal': [
      { difficulty: 'facil', prompt: 'Ele é um ___ aluno, nunca estuda.', options: ['mau', 'mal', 'máu', 'mall'], correctAnswer: 'mau', explanation: '"Mau" é adjetivo, oposto de "bom".' },
      { difficulty: 'medio', prompt: 'Ela se sentiu ___ depois da viagem.', options: ['mal', 'mau', 'máu', 'malle'], correctAnswer: 'mal', explanation: '"Mal" é advérbio aqui, oposto de "bem".' },
    ],
  };

  async function getQuizRound(gameId, difficulty) {
    const template = QUIZ_PROMPTS[gameId];
    const systemPrompt = `${template.replace('{difficulty}', difficulty)} Responda SOMENTE em JSON, sem markdown, neste formato: ${QUIZ_JSON_FORMAT}`;
    const round = await generateViaAI({ systemPrompt, mockPool: QUIZ_MOCKS[gameId], difficulty });
    round.options = shuffle(round.options);
    return round;
  }

  // =================== FAMÍLIA "DIGITAÇÃO" (escrever a resposta) ===================

  const TYPING_PROMPTS = {
    acentuacao: 'Escolha uma palavra portuguesa que leve acento e escreva ela SEM os acentos no prompt (ex: "sinonimo"), pedindo pra escrever com a acentuação correta. correctAnswer deve ter os acentos certos. Nível: {difficulty}.',
    'escrita-correta': 'Dê uma dica/definição curta em português de uma palavra (sem falar a palavra), pra o jogador escrever qual é. Nível: {difficulty}.',
    'complete-palavra': 'Escolha uma palavra portuguesa e no prompt mostre ela com 2 ou 3 letras faltando substituídas por "_" (ex: "elef_nt_"), pedindo pra completar. correctAnswer é a palavra completa. Nível: {difficulty}.',
    'correcao-erros': 'Escreva uma frase em português com 1 ou 2 erros de ortografia/gramática propositais no prompt, pedindo pra reescrever corrigida. correctAnswer é a frase corrigida. Nível: {difficulty}.',
    'plural-singular': 'Peça pra transformar uma palavra do singular pro plural OU do plural pro singular (decida aleatoriamente e deixe claro no prompt qual). Nível: {difficulty}.',
    verbos: 'Peça pra conjugar um verbo português num tempo/pessoa específicos, deixando claro no prompt qual verbo, tempo e pessoa. Nível: {difficulty}.',
  };

  const TYPING_JSON_FORMAT = '{"prompt": "...", "correctAnswer": "...", "explanation": "..."}';

  const TYPING_MOCKS = {
    acentuacao: [
      { difficulty: 'facil', prompt: 'Escreva com a acentuação correta: "sinonimo"', correctAnswer: 'sinônimo', explanation: '"Sinônimo" é proparoxítona — todas levam acento.' },
      { difficulty: 'facil', prompt: 'Escreva com a acentuação correta: "voce"', correctAnswer: 'você', explanation: '"Você" leva acento agudo na última sílaba (oxítona terminada em "e").' },
      { difficulty: 'medio', prompt: 'Escreva com a acentuação correta: "arvore"', correctAnswer: 'árvore', explanation: '"Árvore" é proparoxítona — sempre acentuada.' },
      { difficulty: 'dificil', prompt: 'Escreva com a acentuação correta: "juiz"', correctAnswer: 'juiz', explanation: 'Pegadinha: "juiz" não leva acento (ditongo "ui" átono em monossílabo/oxítona não acentuada aqui).' },
    ],
    'escrita-correta': [
      { difficulty: 'facil', prompt: 'É uma ave que anda na água e faz "quá-quá".', correctAnswer: 'pato', explanation: '"Pato" é a ave aquática que faz esse som.' },
      { difficulty: 'facil', prompt: 'Fruta amarela, comprida, que os macacos adoram.', correctAnswer: 'banana', explanation: 'Descrição clássica da banana.' },
      { difficulty: 'medio', prompt: 'Sentimento de tristeza profunda por perder alguém ou algo querido.', correctAnswer: 'luto', explanation: '"Luto" é o sentimento/estado de pesar por uma perda.' },
      { difficulty: 'dificil', prompt: 'Palavra que descreve um texto que pode ser lido de trás pra frente e tem o mesmo sentido.', correctAnswer: 'palíndromo', explanation: 'Exemplos: "arara", "osso".' },
    ],
    'complete-palavra': [
      { difficulty: 'facil', prompt: 'Complete: C_CH_RR_', correctAnswer: 'cachorro', explanation: 'C-A-C-H-O-R-R-O.' },
      { difficulty: 'medio', prompt: 'Complete: B_BL_OT_C_', correctAnswer: 'biblioteca', explanation: 'B-I-B-L-I-O-T-E-C-A.' },
      { difficulty: 'dificil', prompt: 'Complete: _XTR_ORD_NÁR_O', correctAnswer: 'extraordinário', explanation: 'E-X-T-R-A-O-R-D-I-N-Á-R-I-O.' },
    ],
    'correcao-erros': [
      { difficulty: 'facil', prompt: 'Corrija: "Nós vai pra escola agora."', correctAnswer: 'Nós vamos para a escola agora.', explanation: '"Nós" pede "vamos", e "pra" na escrita formal é "para a".' },
      { difficulty: 'medio', prompt: 'Corrija: "Ele fazem muitos erro nas prova."', correctAnswer: 'Ele faz muitos erros nas provas.', explanation: '"Ele" é singular ("faz"), e "erro"/"prova" precisam do plural.' },
      { difficulty: 'dificil', prompt: 'Corrija: "Houveram vários problema com o projeto ontem."', correctAnswer: 'Houve vários problemas com o projeto ontem.', explanation: '"Haver" no sentido de existir é impessoal (nunca plural), e "problema" precisa do plural.' },
    ],
    'plural-singular': [
      { difficulty: 'facil', prompt: 'Escreva no plural: "gato"', correctAnswer: 'gatos', explanation: 'Plural regular: só acrescenta "s".' },
      { difficulty: 'medio', prompt: 'Escreva no plural: "papel"', correctAnswer: 'papéis', explanation: 'Palavras terminadas em "-al" fazem plural em "-ais"... "papel" é exceção: "-el" vira "-éis".' },
      { difficulty: 'dificil', prompt: 'Escreva no singular: "cidadãos"', correctAnswer: 'cidadão', explanation: 'Palavras em "-ão" têm plurais variados; "cidadão" faz "cidadãos".' },
    ],
    verbos: [
      { difficulty: 'facil', prompt: 'Conjugue "cantar" no presente do indicativo, 3ª pessoa do singular (ele/ela).', correctAnswer: 'canta', explanation: 'Ele/ela canta.' },
      { difficulty: 'medio', prompt: 'Conjugue "fazer" no pretérito perfeito, 1ª pessoa do singular (eu).', correctAnswer: 'fiz', explanation: '"Fazer" é irregular: eu fiz.' },
      { difficulty: 'dificil', prompt: 'Conjugue "trazer" no futuro do subjuntivo, 3ª pessoa do singular (ele/ela).', correctAnswer: 'trouxer', explanation: '"Trazer" no futuro do subjuntivo: se ele trouxer.' },
    ],
  };

  async function getTypingRound(gameId, difficulty) {
    const template = TYPING_PROMPTS[gameId];
    const systemPrompt = `${template.replace('{difficulty}', difficulty)} Responda SOMENTE em JSON, sem markdown, neste formato: ${TYPING_JSON_FORMAT}`;
    return generateViaAI({ systemPrompt, mockPool: TYPING_MOCKS[gameId], difficulty });
  }

  // =================== JOGOS ESPECIAIS ===================

  const HANGMAN_MOCKS = {
    facil: [
      { word: 'gato', clue: 'Animal doméstico que mia.' },
      { word: 'sol', clue: 'Estrela que ilumina o dia.' },
      { word: 'casa', clue: 'Lugar onde se mora.' },
    ],
    medio: [
      { word: 'biblioteca', clue: 'Lugar cheio de livros.' },
      { word: 'computador', clue: 'Aparelho eletrônico de trabalho e estudo.' },
    ],
    dificil: [
      { word: 'extraordinário', clue: 'Fora do comum, excepcional.' },
      { word: 'paralelepípedo', clue: 'Sólido geométrico com 6 faces paralelas duas a duas.' },
    ],
  };

  async function getHangmanWord(difficulty) {
    const systemPrompt = `Escolha uma palavra em português (sem acentos especiais complicados de exibir) pro jogo da forca, nível ${difficulty}, e uma dica curta. Responda SOMENTE em JSON: {"word": "...", "clue": "..."}. A palavra deve ter só letras, sem espaço ou hífen.`;
    return ScriptaAI._tryTiers({
      direct: async () => {
        const raw = await ScriptaAI._directComplete(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Gere agora.' }],
          { temperature: 0.9 }
        );
        return JSON.parse(ScriptaAI._stripCodeFence(raw));
      },
      backend: async () => { throw new Error('sem rota de backend pra jogos ainda'); },
      mock: () => pick(HANGMAN_MOCKS[difficulty] || HANGMAN_MOCKS.facil),
    });
  }

  const MEMORY_PAIRS_MOCKS = {
    facil: [['feliz', 'contente'], ['grande', 'enorme'], ['rápido', 'veloz'], ['bonito', 'lindo'], ['triste', 'infeliz'], ['forte', 'robusto']],
    medio: [['perspicaz', 'sagaz'], ['efêmero', 'passageiro'], ['ousado', 'audacioso'], ['sereno', 'calmo'], ['árduo', 'difícil'], ['ameno', 'suave']],
    dificil: [['perene', 'duradouro'], ['lúcido', 'racional'], ['parco', 'escasso'], ['prolixo', 'extenso'], ['dirimir', 'resolver'], ['aquiescer', 'concordar']],
  };

  function getMemoryPairs(difficulty) {
    // Jogo da memória funciona bem com um banco fixo de pares — não
    // precisa de geração dinâmica por IA a cada rodada.
    return (MEMORY_PAIRS_MOCKS[difficulty] || MEMORY_PAIRS_MOCKS.facil).slice(0, 6);
  }

  const CATEGORY_MOCKS = {
    facil: [
      { category: 'Animais', examples: ['cachorro', 'gato', 'elefante', 'leão', 'macaco', 'cavalo', 'urso', 'peixe', 'pato', 'vaca'] },
      { category: 'Frutas', examples: ['maçã', 'banana', 'laranja', 'uva', 'manga', 'abacaxi', 'morango', 'melancia', 'pera', 'limão'] },
    ],
    medio: [
      { category: 'Países', examples: ['brasil', 'argentina', 'portugal', 'frança', 'japão', 'canadá', 'egito', 'itália', 'méxico', 'chile'] },
      { category: 'Profissões', examples: ['médico', 'professor', 'engenheiro', 'advogado', 'cozinheiro', 'piloto', 'enfermeiro', 'jornalista'] },
    ],
    dificil: [
      { category: 'Elementos químicos', examples: ['ouro', 'ferro', 'oxigênio', 'hidrogênio', 'carbono', 'sódio', 'potássio', 'cálcio'] },
      { category: 'Figuras de linguagem', examples: ['metáfora', 'ironia', 'hipérbole', 'eufemismo', 'antítese', 'metonímia', 'prosopopeia'] },
    ],
  };

  function getCategoryChallenge(difficulty) {
    return pick(CATEGORY_MOCKS[difficulty] || CATEGORY_MOCKS.facil);
  }

  const TABOO_MOCKS = {
    facil: [
      { word: 'cachorro', forbidden: ['animal', 'late', 'pet', 'cão'] },
      { word: 'chuva', forbidden: ['água', 'céu', 'molhado', 'nuvem'] },
    ],
    medio: [
      { word: 'saudade', forbidden: ['sentir', 'falta', 'longe', 'lembrança'] },
      { word: 'democracia', forbidden: ['governo', 'povo', 'voto', 'eleição'] },
    ],
    dificil: [
      { word: 'efêmero', forbidden: ['passageiro', 'dura', 'pouco', 'tempo'] },
      { word: 'paradoxo', forbidden: ['contradição', 'lógica', 'contrário', 'ideia'] },
    ],
  };

  async function getTabooChallenge(difficulty) {
    const systemPrompt = `Escolha uma palavra em português nível ${difficulty} pro jogo "palavra proibida" (tabu) e liste 4 palavras relacionadas que ficam proibidas de usar na explicação. Responda SOMENTE em JSON: {"word": "...", "forbidden": ["...","...","...","..."]}`;
    return ScriptaAI._tryTiers({
      direct: async () => {
        const raw = await ScriptaAI._directComplete(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Gere agora.' }],
          { temperature: 0.9 }
        );
        return JSON.parse(ScriptaAI._stripCodeFence(raw));
      },
      backend: async () => { throw new Error('sem rota de backend pra jogos ainda'); },
      mock: () => pick(TABOO_MOCKS[difficulty] || TABOO_MOCKS.facil),
    });
  }

  const SPEED_MOCKS = {
    facil: [
      { clue: 'Cor do céu num dia claro.', answer: 'azul' },
      { clue: 'Animal que voa e faz mel.', answer: 'abelha' },
      { clue: 'Refeição da manhã.', answer: 'café da manhã' },
      { clue: 'Oposto de "quente".', answer: 'frio' },
      { clue: 'Onde os peixes vivem.', answer: 'água' },
      { clue: 'Número depois do 9.', answer: 'dez' },
      { clue: 'Dia depois de sexta.', answer: 'sábado' },
      { clue: 'Cor da grama.', answer: 'verde' },
    ],
    medio: [
      { clue: 'Sinônimo de "rápido".', answer: 'veloz' },
      { clue: 'Instrumento usado por dentistas.', answer: 'broca' },
      { clue: 'Capital do Brasil.', answer: 'brasília' },
      { clue: 'Antônimo de "generoso".', answer: 'mesquinho' },
      { clue: 'Planeta mais próximo do Sol.', answer: 'mercúrio' },
      { clue: 'Ferramenta pra cortar papel.', answer: 'tesoura' },
    ],
    dificil: [
      { clue: 'Figura de linguagem que usa exagero.', answer: 'hipérbole' },
      { clue: 'Sinônimo de "efêmero".', answer: 'passageiro' },
      { clue: 'Sólido geométrico de 6 faces paralelas.', answer: 'paralelepípedo' },
      { clue: 'Antônimo de "lúcido".', answer: 'confuso' },
    ],
  };

  function getSpeedRoundWords(difficulty) {
    return shuffle(SPEED_MOCKS[difficulty] || SPEED_MOCKS.facil);
  }

  const WORD_OF_DAY_MOCKS = [
    { word: 'perspicaz', meaning: 'que percebe as coisas com facilidade; sagaz, perceptivo.', example: 'A investigadora foi perspicaz ao notar o detalhe que todos ignoraram.', quiz: { prompt: 'O que significa "perspicaz"?', options: ['Distraído', 'Que percebe com facilidade', 'Lento', 'Confuso'], correctAnswer: 'Que percebe com facilidade', explanation: 'Perspicaz = sagaz, que tem percepção aguçada.' } },
    { word: 'efêmero', meaning: 'que dura pouco tempo; passageiro, transitório.', example: 'A beleza das flores de cerejeira é efêmera, dura poucos dias.', quiz: { prompt: 'Qual é o antônimo de "efêmero"?', options: ['Duradouro', 'Passageiro', 'Breve', 'Rápido'], correctAnswer: 'Duradouro', explanation: 'Efêmero (dura pouco) se opõe a duradouro (dura muito).' } },
    { word: 'ubíquo', meaning: 'que está presente em todos os lugares ao mesmo tempo.', example: 'A tecnologia se tornou ubíqua em nossas vidas.', quiz: { prompt: 'O que significa "ubíquo"?', options: ['Escasso', 'Presente em todo lugar', 'Antigo', 'Invisível'], correctAnswer: 'Presente em todo lugar', explanation: 'Ubíquo vem do latim "ubique" (em toda parte).' } },
    { word: 'parco', meaning: 'escasso, pouco abundante; econômico.', example: 'Ele vivia com um salário parco, mas nunca reclamava.', quiz: { prompt: 'Sinônimo de "parco":', options: ['Abundante', 'Escasso', 'Generoso', 'Rico'], correctAnswer: 'Escasso', explanation: 'Parco = pouco, escasso, moderado.' } },
  ];

  function getWordOfDay() {
    // Determinístico por dia (mesma palavra o dia todo), baseado na data.
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return WORD_OF_DAY_MOCKS[dayIndex % WORD_OF_DAY_MOCKS.length];
  }

  const REVEAL_MOCKS = {
    facil: [
      { word: 'chuva', hints: ['Vem do céu.', 'Está relacionada à água.', 'Acontece quando há nuvens escuras.', 'Você usa guarda-chuva por causa dela.'] },
      { word: 'escola', hints: ['É um lugar.', 'Crianças e jovens vão lá todo dia.', 'Tem professores e alunos.', 'É onde a gente aprende a ler e escrever.'] },
    ],
    medio: [
      { word: 'biblioteca', hints: ['É um lugar público ou privado.', 'Tem prateleiras.', 'Fica em silêncio lá dentro.', 'É onde ficam guardados muitos livros.'] },
      { word: 'saudade', hints: ['É um sentimento.', 'Está ligado à ausência.', 'É considerada uma palavra típica do português.', 'Você sente isso de quem ou do que está longe.'] },
    ],
    dificil: [
      { word: 'efêmero', hints: ['É um adjetivo.', 'Está relacionado ao tempo.', 'O contrário de duradouro.', 'Descreve algo que dura muito pouco tempo.'] },
      { word: 'paradoxo', hints: ['É um substantivo abstrato.', 'Aparece em lógica e filosofia.', 'Parece contraditório, mas pode ser verdadeiro.', 'É uma ideia que contém uma contradição aparente.'] },
    ],
  };

  async function getRevealWord(difficulty) {
    const systemPrompt = `Escolha uma palavra em português nível ${difficulty} e crie 4 dicas progressivas pra adivinhar ela, da mais vaga pra mais óbvia (a última quase entrega a resposta, mas sem citar a palavra). Responda SOMENTE em JSON: {"word": "...", "hints": ["...","...","...","..."]}`;
    return ScriptaAI._tryTiers({
      direct: async () => {
        const raw = await ScriptaAI._directComplete(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Gere agora.' }],
          { temperature: 0.9 }
        );
        return JSON.parse(ScriptaAI._stripCodeFence(raw));
      },
      backend: async () => { throw new Error('sem rota de backend pra jogos ainda'); },
      mock: () => pick(REVEAL_MOCKS[difficulty] || REVEAL_MOCKS.facil),
    });
  }

  return {
    getQuizRound,
    getTypingRound,
    getHangmanWord,
    getMemoryPairs,
    getCategoryChallenge,
    getTabooChallenge,
    getSpeedRoundWords,
    getWordOfDay,
    getRevealWord,
  };
})();
