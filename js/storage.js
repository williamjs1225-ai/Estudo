/**
 * storage.js
 * -----------------------------------------------------------------------
 * Camada de persistência local, agora sobre IndexedDB (banco de dados de
 * verdade do navegador, padrão em PWAs) em vez de localStorage — mais
 * espaço, mais robusto, e ainda funciona 100% offline. App de uso
 * pessoal — não há autenticação, tudo fica no dispositivo. Quando quiser
 * sincronizar entre aparelhos, troque estas funções por chamadas ao
 * backend em /server (que já fala com Supabase), mantendo a mesma
 * assinatura.
 *
 * Como funciona por baixo dos panos:
 *   Todo o resto do app (home.js, editor.js, games-*.js etc.) chama
 *   ScriptaStorage.getX()/setX() de forma SÍNCRONA, sem await — então,
 *   em vez de tornar cada uma dessas dezenas de chamadas assíncronas
 *   (o que exigiria reescrever o app inteiro), mantemos um espelho em
 *   memória (`cache`) que é lido/escrito na hora, e cada escrita também
 *   dispara uma gravação assíncrona no IndexedDB em segundo plano. No
 *   carregamento do app, `ScriptaStorage.ready()` (chamado pelo
 *   splash.js antes de mostrar qualquer tela) espera o banco carregar
 *   tudo pra dentro do cache antes do app ficar interativo.
 * -----------------------------------------------------------------------
 */

const ScriptaStorage = (() => {
  const KEYS = {
    USER: 'scripta:user',
    STATS: 'scripta:stats',
    TEXTS: 'scripta:texts',
    VOCAB: 'scripta:vocab',
    PLAN: 'scripta:plan',
    READING: 'scripta:reading',
    CHAT: 'scripta:chat',
    AI_CONFIG: 'scripta:ai-config',
    EXERCISE: 'scripta:exercise',
    HISTORY: 'scripta:history',
    GAMES: 'scripta:games',
  };

  const DB_NAME = 'scripta-db';
  const DB_VERSION = 1;
  const STORE_NAME = 'kv';

  let db = null;
  const cache = {}; // espelho em memória — é nele que read()/write() mexem de verdade

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB não suportado')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function loadAllIntoCache() {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cache[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Promise única que resolve quando o banco terminou de carregar tudo pro
  // cache. splash.js espera essa promise antes de mostrar qualquer tela.
  const dbReady = (async () => {
    try {
      db = await openDB();
      await loadAllIntoCache();
    } catch (err) {
      console.warn('[ScriptaStorage] IndexedDB indisponível — usando armazenamento só desta sessão (não vai persistir ao recarregar):', err.message);
    }
  })();

  function persistToDB(key, value) {
    if (!db) return;
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
    } catch (err) {
      console.warn('[ScriptaStorage] falha ao gravar no IndexedDB', key, err);
    }
  }

  function read(key, fallback) {
    return key in cache ? cache[key] : fallback;
  }

  function write(key, value) {
    cache[key] = value;
    persistToDB(key, value);
    return value;
  }

  function clearAll() {
    Object.keys(cache).forEach((k) => delete cache[k]);
    if (db) {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch (err) {
        console.warn('[ScriptaStorage] falha ao limpar IndexedDB', err);
      }
    }
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // ---- Perfil ----
  const DEFAULT_USER = {
    name: 'Williams',
    goalDailyWords: 500,
    avatarEmoji: '✍️',
    preferences: { notifications: true, customKeyboard: true },
  };

  // ---- Estatísticas ----
  const DEFAULT_STATS = {
    streakDays: 12,
    weekActivity: [true, true, true, true, true, true, true],
    wordsTotal: 24531,
    wordsDelta: '+12%',
    textsTotal: 18,
    textsDelta: '+2',
    vocabLearned: 1248,
    vocabDelta: '+18',
    accuracy: 94,
    readingTextsCount: 12,
    readingMinutes: 330,
    readingComprehension: 85,
  };

  // ---- Textos ----
  const SEED_TEXTS = [{
    id: 'seed-1',
    title: 'Texto: Meu diário',
    content: 'Hoje foi um dia produtivo. Escrevi bastante e senti que minhas ideias fluíram com mais clareza do que de costume...',
    words: 1256,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  }];

  // ---- Vocabulário ----
  const SEED_VOCAB = [
    { id: 'v1', word: 'perspicaz', definition: 'que percebe com facilidade; perceptivo, sagaz.', addedAt: Date.now() - 1000 * 60 * 60 * 24 * 3 },
    { id: 'v2', word: 'efêmero', definition: 'que dura pouco tempo; passageiro, transitório.', addedAt: Date.now() - 1000 * 60 * 60 * 24 * 1 },
  ];

  // ---- Plano de estudo ----
  const DEFAULT_PLAN = {
    weekFocus: { label: 'Escrever com mais clareza', pct: 38 },
    daily: [
      { id: 'p1', label: 'Escrever 300 palavras', done: true },
      { id: 'p2', label: 'Ler por 20 minutos', done: true },
      { id: 'p3', label: 'Aprender 5 palavras novas', done: true },
      { id: 'p4', label: 'Revisar um texto com IA', done: false },
    ],
  };

  // ---- Leitura ----
  const DEFAULT_READING = {
    weeklyGoal: 5,
    weeklyDone: 3,
    lastSummary: 'Você leu 2 textos hoje. Continue assim para alcançar sua meta semanal!',
  };

  // ---- Exercícios ----
  const DEFAULT_EXERCISE_STATE = { level: 1, correctStreak: 0, wrongStreak: 0, completed: 0 };

  // ---- Histórico diário (alimenta os gráficos de evolução) ----
  function seedHistory() {
    const days = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, words: Math.round(150 + Math.random() * 350), accuracy: Math.round(78 + Math.random() * 18) });
    }
    return days;
  }

  // ---- Minijogos ----
  const GAME_IDS = [
    'acentuacao', 'escrita-correta', 'forca', 'complete-palavra', 'complete-frase',
    'sinonimos-antonimos', 'ortografia', 'correcao-erros', 'porque', 'plural-singular',
    'mas-mais', 'mau-mal', 'verbos', 'descubra-palavra', 'memoria', 'categorias',
    'palavra-proibida', 'desafio-velocidade', 'palavra-do-dia',
  ];

  const XP_PER_LEVEL = 150;

  function defaultPerGame() {
    const obj = {};
    GAME_IDS.forEach((id) => {
      obj[id] = { plays: 0, correct: 0, total: 0, bestScore: 0, difficulty: 'facil', lastPlayedAt: null };
    });
    return obj;
  }

  function defaultGames() {
    return { xp: 0, level: 1, coins: 0, badges: [], perGame: defaultPerGame(), lastWordOfDayDate: null };
  }

  const BADGE_DEFS = [
    { id: 'primeiro-jogo', label: 'Primeiro jogo', icon: '🎮', check: (g) => Object.values(g.perGame).some((pg) => pg.plays > 0) },
    { id: 'nivel-5', label: 'Nível 5', icon: '⭐', check: (g) => g.level >= 5 },
    { id: 'nivel-10', label: 'Nível 10', icon: '🌟', check: (g) => g.level >= 10 },
    { id: 'cem-acertos', label: '100 acertos', icon: '💯', check: (g) => Object.values(g.perGame).reduce((s, pg) => s + pg.correct, 0) >= 100 },
    { id: 'explorador', label: 'Explorou todos os jogos', icon: '🧭', check: (g) => Object.values(g.perGame).every((pg) => pg.plays > 0) },
  ];

  function levelForXp(xp) {
    return Math.floor(xp / XP_PER_LEVEL) + 1;
  }

  return {
    // Perfil
    getUser: () => read(KEYS.USER, DEFAULT_USER),
    setUser: (user) => write(KEYS.USER, user),

    // Estatísticas
    getStats: () => read(KEYS.STATS, DEFAULT_STATS),
    setStats: (stats) => write(KEYS.STATS, stats),
    patchStats: (patch) => write(KEYS.STATS, { ...read(KEYS.STATS, DEFAULT_STATS), ...patch }),

    // Textos
    getTexts: () => read(KEYS.TEXTS, SEED_TEXTS).sort((a, b) => b.updatedAt - a.updatedAt),
    getText: (id) => (read(KEYS.TEXTS, SEED_TEXTS)).find((t) => t.id === id) || null,
    getRecentText: () => (read(KEYS.TEXTS, SEED_TEXTS)).sort((a, b) => b.updatedAt - a.updatedAt)[0],
    saveText: (text) => {
      const texts = read(KEYS.TEXTS, SEED_TEXTS);
      const now = Date.now();
      if (text.id) {
        const idx = texts.findIndex((t) => t.id === text.id);
        if (idx >= 0) {
          texts[idx] = { ...texts[idx], ...text, updatedAt: now };
          write(KEYS.TEXTS, texts);
          return texts[idx];
        }
      }
      const created = { id: uid(), createdAt: now, updatedAt: now, words: 0, ...text };
      texts.push(created);
      write(KEYS.TEXTS, texts);
      return created;
    },
    deleteText: (id) => write(KEYS.TEXTS, read(KEYS.TEXTS, SEED_TEXTS).filter((t) => t.id !== id)),

    // Vocabulário
    getVocab: () => read(KEYS.VOCAB, SEED_VOCAB).sort((a, b) => b.addedAt - a.addedAt),
    addVocabWord: (word, definition) => {
      const list = read(KEYS.VOCAB, SEED_VOCAB);
      const entry = { id: uid(), word, definition, addedAt: Date.now() };
      list.push(entry);
      write(KEYS.VOCAB, list);
      return entry;
    },

    // Plano de estudo
    getPlan: () => read(KEYS.PLAN, DEFAULT_PLAN),
    togglePlanItem: (id) => {
      const plan = read(KEYS.PLAN, DEFAULT_PLAN);
      plan.daily = plan.daily.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      write(KEYS.PLAN, plan);
      return plan;
    },

    // Leitura
    getReadingState: () => read(KEYS.READING, DEFAULT_READING),
    setReadingState: (state) => write(KEYS.READING, state),

    // Exercícios
    getExerciseState: () => read(KEYS.EXERCISE, DEFAULT_EXERCISE_STATE),
    setExerciseState: (state) => write(KEYS.EXERCISE, state),
    registerExerciseResult: (correct) => {
      const state = read(KEYS.EXERCISE, DEFAULT_EXERCISE_STATE);
      state.completed += 1;
      if (correct) {
        state.correctStreak += 1;
        state.wrongStreak = 0;
        if (state.correctStreak >= 3 && state.level < 5) {
          state.level += 1;
          state.correctStreak = 0;
        }
      } else {
        state.wrongStreak += 1;
        state.correctStreak = 0;
        if (state.wrongStreak >= 2 && state.level > 1) {
          state.level -= 1;
          state.wrongStreak = 0;
        }
      }
      write(KEYS.EXERCISE, state);
      return state;
    },

    // Histórico diário (para os gráficos de evolução)
    getHistory: () => read(KEYS.HISTORY, seedHistory()),
    logDailyProgress: ({ words = 0, accuracy = null } = {}) => {
      const history = read(KEYS.HISTORY, seedHistory());
      const todayKey = new Date().toISOString().slice(0, 10);
      let today = history.find((d) => d.date === todayKey);
      if (!today) {
        today = { date: todayKey, words: 0, accuracy: accuracy ?? 80 };
        history.push(today);
      }
      today.words += words;
      if (accuracy !== null) today.accuracy = accuracy;
      // mantém só os últimos 14 dias
      const trimmed = history.slice(-14);
      write(KEYS.HISTORY, trimmed);
      return trimmed;
    },

    // Chave de IA (configurada pelo próprio usuário na tela Perfil)
    getAIConfig: () => read(KEYS.AI_CONFIG, { provider: 'groq', apiKey: '' }),
    setAIConfig: (cfg) => write(KEYS.AI_CONFIG, cfg),

    // Chat com IA Coach
    getChatHistory: () => read(KEYS.CHAT, []),
    appendChatMessage: (role, content) => {
      const history = read(KEYS.CHAT, []);
      history.push({ role, content, ts: Date.now() });
      write(KEYS.CHAT, history);
      return history;
    },
    clearChatHistory: () => write(KEYS.CHAT, []),

    // Minijogos
    getGamesData: () => read(KEYS.GAMES, defaultGames()),
    getGameStats: (gameId) => (read(KEYS.GAMES, defaultGames())).perGame[gameId] || { plays: 0, correct: 0, total: 0, bestScore: 0, difficulty: 'facil', lastPlayedAt: null },
    setGameDifficulty: (gameId, difficulty) => {
      const games = read(KEYS.GAMES, defaultGames());
      if (!games.perGame[gameId]) games.perGame[gameId] = { plays: 0, correct: 0, total: 0, bestScore: 0, difficulty: 'facil', lastPlayedAt: null };
      games.perGame[gameId].difficulty = difficulty;
      write(KEYS.GAMES, games);
    },
    getBadgeDefs: () => BADGE_DEFS,

    /** Registra o resultado de uma rodada e aplica XP/moedas/nível/badges. */
    recordGameResult: (gameId, { correct = 0, total = 0, difficulty = 'facil' } = {}) => {
      const games = read(KEYS.GAMES, defaultGames());
      if (!games.perGame[gameId]) games.perGame[gameId] = { plays: 0, correct: 0, total: 0, bestScore: 0, difficulty: 'facil', lastPlayedAt: null };
      const pg = games.perGame[gameId];

      pg.plays += 1;
      pg.correct += correct;
      pg.total += total;
      pg.difficulty = difficulty;
      pg.lastPlayedAt = Date.now();
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      if (score > pg.bestScore) pg.bestScore = score;

      const diffMult = difficulty === 'dificil' ? 2 : difficulty === 'medio' ? 1.5 : 1;
      const xpGained = Math.round(correct * 10 * diffMult);
      const coinsGained = correct;
      const prevLevel = games.level;
      games.xp += xpGained;
      games.coins += coinsGained;
      games.level = levelForXp(games.xp);

      const newBadges = [];
      BADGE_DEFS.forEach((b) => {
        if (!games.badges.includes(b.id) && b.check(games)) {
          games.badges.push(b.id);
          newBadges.push(b);
        }
      });

      write(KEYS.GAMES, games);

      // Também conta como progresso de escrita/prática no restante do app.
      const stats = read(KEYS.STATS, DEFAULT_STATS);
      write(KEYS.STATS, { ...stats, vocabLearned: stats.vocabLearned + correct });

      return { xpGained, coinsGained, leveledUp: games.level > prevLevel, newLevel: games.level, newBadges, score };
    },

    getWordOfDayState: () => read(KEYS.GAMES, defaultGames()).lastWordOfDayDate,
    setWordOfDaySeen: () => {
      const games = read(KEYS.GAMES, defaultGames());
      games.lastWordOfDayDate = new Date().toISOString().slice(0, 10);
      write(KEYS.GAMES, games);
    },

    /** Promise que resolve quando o IndexedDB terminou de carregar — splash.js espera isso antes de mostrar qualquer tela. */
    ready: () => dbReady,
    /** Apaga TUDO (usado pelo botão "Limpar dados locais" no Perfil). */
    clearAll,
  };
})();
