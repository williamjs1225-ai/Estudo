/**
 * games-special.js
 * -----------------------------------------------------------------------
 * Os 7 minijogos com mecânica própria (não encaixam no quiz/digitação
 * genéricos): Forca, Memória, Categorias, Palavra Proibida, Desafio de
 * Velocidade, Palavra do Dia e Descubra a Palavra (dicas progressivas).
 * -----------------------------------------------------------------------
 */

// ==================== FORCA ====================

const ScriptaGameForca = (() => {
  const WORDS_PER_SESSION = 3;
  const MAX_WRONG = { facil: 8, medio: 6, dificil: 5 };
  let wordIndex = 0;
  let current = null;
  let guessed = new Set();
  let wrongCount = 0;
  let roundWins = 0;

  const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const ACCENTS = 'áàâãéêíóôõúüç'.split('');

  async function start(gameId, difficulty) {
    wordIndex = 0;
    roundWins = 0;
    ScriptaGameSession.start(gameId, difficulty);
    await nextWord();
  }

  async function nextWord() {
    if (wordIndex >= WORDS_PER_SESSION) { ScriptaGameSession.finish({ correct: roundWins, total: WORDS_PER_SESSION }); return; }
    wordIndex += 1;
    guessed = new Set();
    wrongCount = 0;
    document.getElementById('game-body').innerHTML = '<p class="tab-panel__hint">Preparando palavra...</p>';
    current = await ScriptaGamesContent.getHangmanWord(ScriptaGameSession.difficulty);
    current.word = current.word.toLowerCase();
    render();
  }

  function render() {
    const maxWrong = MAX_WRONG[ScriptaGameSession.difficulty] || 8;
    document.getElementById('game-body').innerHTML = `
      <p class="tab-panel__hint" style="padding-top:0">Palavra ${wordIndex} de ${WORDS_PER_SESSION} — ${escapeHtml(current.clue)}</p>
      <p class="hangman-lives">${'❤️'.repeat(Math.max(0, maxWrong - wrongCount))}${'🖤'.repeat(wrongCount)}</p>
      <div class="hangman-word" id="hangman-word"></div>
      <div class="hangman-keyboard" id="hangman-keyboard">
        ${ALPHABET.map((l) => `<button type="button" class="hangman-key" data-letter="${l}">${l.toUpperCase()}</button>`).join('')}
      </div>
      <div class="hangman-keyboard hangman-keyboard--accents" id="hangman-keyboard-accents">
        ${ACCENTS.map((l) => `<button type="button" class="hangman-key" data-letter="${l}">${l.toUpperCase()}</button>`).join('')}
      </div>
      <div class="game-feedback" id="hangman-feedback" hidden></div>
    `;
    renderWord();
    document.getElementById('hangman-keyboard').addEventListener('click', onLetterClick);
    document.getElementById('hangman-keyboard-accents').addEventListener('click', onLetterClick);
  }

  function renderWord() {
    document.getElementById('hangman-word').innerHTML = current.word.split('').map((ch) => `
      <span class="hangman-word__letter">${guessed.has(ch) ? ch.toUpperCase() : ''}</span>
    `).join('');
  }

  function onLetterClick(e) {
    const btn = e.target.closest('[data-letter]');
    if (!btn || btn.disabled) return;
    const letter = btn.dataset.letter;
    btn.disabled = true;
    guessed.add(letter);

    if (current.word.includes(letter)) {
      btn.classList.add('is-correct');
    } else {
      btn.classList.add('is-wrong');
      wrongCount += 1;
    }
    renderWord();

    const maxWrong = MAX_WRONG[ScriptaGameSession.difficulty] || 8;
    document.querySelector('.hangman-lives').textContent = '❤️'.repeat(Math.max(0, maxWrong - wrongCount)) + '🖤'.repeat(wrongCount);

    const won = current.word.split('').every((ch) => guessed.has(ch));
    const lost = wrongCount >= maxWrong;

    if (won || lost) {
      document.getElementById('hangman-keyboard').removeEventListener('click', onLetterClick);
      document.getElementById('hangman-keyboard-accents').removeEventListener('click', onLetterClick);
      document.querySelectorAll('.hangman-key').forEach((k) => { k.disabled = true; });
      if (won) roundWins += 1;
      const el = document.getElementById('hangman-feedback');
      el.hidden = false;
      el.className = `game-feedback ${won ? 'is-correct' : 'is-wrong'}`;
      el.innerHTML = `
        <strong>${won ? '✓ Você salvou! 🎉' : `✕ Não dessa vez — a palavra era "${escapeHtml(current.word)}"`}</strong>
        <p>${escapeHtml(current.clue)}</p>
        <button type="button" class="btn btn-primary" id="hangman-continue" style="margin-top:var(--sp-3)">Continuar</button>
      `;
      document.getElementById('hangman-continue').addEventListener('click', nextWord);
    }
  }

  return { start };
})();

// ==================== MEMÓRIA ====================

const ScriptaGameMemoria = (() => {
  let cards = [];
  let flipped = [];
  let matchedCount = 0;
  let attempts = 0;
  let lockBoard = false;

  function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

  async function start(gameId, difficulty) {
    ScriptaGameSession.start(gameId, difficulty);
    const pairs = ScriptaGamesContent.getMemoryPairs(difficulty);
    cards = shuffle(pairs.flatMap((pair, i) => [
      { id: `${i}a`, pairId: i, label: pair[0] },
      { id: `${i}b`, pairId: i, label: pair[1] },
    ]));
    flipped = [];
    matchedCount = 0;
    attempts = 0;
    render();
  }

  function render() {
    document.getElementById('game-body').innerHTML = `
      <p class="tab-panel__hint" style="padding-top:0">Encontre os pares de palavras relacionadas (sinônimos).</p>
      <div class="memory-grid" id="memory-grid">
        ${cards.map((c) => `
          <button type="button" class="memory-card" data-id="${c.id}">
            <span class="memory-card__back">?</span>
          </button>
        `).join('')}
      </div>
    `;
    document.getElementById('memory-grid').addEventListener('click', onCardClick);
  }

  function onCardClick(e) {
    if (lockBoard) return;
    const btn = e.target.closest('.memory-card');
    if (!btn || btn.classList.contains('is-flipped') || btn.classList.contains('is-matched')) return;

    const card = cards.find((c) => c.id === btn.dataset.id);
    btn.textContent = card.label;
    btn.classList.add('is-flipped');
    flipped.push({ btn, card });

    if (flipped.length === 2) {
      attempts += 1;
      lockBoard = true;
      const [a, b] = flipped;
      if (a.card.pairId === b.card.pairId) {
        a.btn.classList.add('is-matched');
        b.btn.classList.add('is-matched');
        matchedCount += 1;
        flipped = [];
        lockBoard = false;
        checkFinish();
      } else {
        setTimeout(() => {
          a.btn.classList.remove('is-flipped');
          b.btn.classList.remove('is-flipped');
          a.btn.textContent = '?';
          b.btn.textContent = '?';
          flipped = [];
          lockBoard = false;
        }, 800);
      }
    }
  }

  function checkFinish() {
    if (matchedCount === cards.length / 2) {
      setTimeout(() => ScriptaGameSession.finish({ correct: matchedCount, total: attempts }), 500);
    }
  }

  return { start };
})();

// ==================== CATEGORIAS (blitz cronometrado) ====================

const ScriptaGameCategorias = (() => {
  const TIME_BY_DIFFICULTY = { facil: 45, medio: 40, dificil: 35 };
  let challenge = null;
  let found = [];
  let attempts = 0;

  function start(gameId, difficulty) {
    ScriptaGameSession.start(gameId, difficulty);
    challenge = ScriptaGamesContent.getCategoryChallenge(difficulty);
    found = [];
    attempts = 0;
    render();
    ScriptaGameSession.startTimer(TIME_BY_DIFFICULTY[difficulty] || 40, finish);
  }

  function render() {
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__hint">Categoria</p>
        <p class="game-round-card__prompt">${escapeHtml(challenge.category)}</p>
      </div>
      <div class="category-input-row">
        <input type="text" id="category-input" placeholder="Digite uma palavra..." autocomplete="off"
          spellcheck="false" autocorrect="off" data-custom-keyboard inputmode="none">
        <button type="button" class="btn-icon" id="category-submit" aria-label="Adicionar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>
      <div class="category-answers" id="category-answers"></div>
    `;
    if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.rescan();
    document.getElementById('category-submit').addEventListener('click', submit);
    document.getElementById('category-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function submit() {
    const input = document.getElementById('category-input');
    const word = input.value.trim().toLowerCase();
    if (!word) return;
    input.value = '';
    attempts += 1;

    const valid = challenge.examples.map((w) => w.toLowerCase()).includes(word) && !found.includes(word);
    if (valid) {
      found.push(word);
      renderAnswers();
      ScriptaApp.showToast('✓ Boa!');
    } else if (found.includes(word)) {
      ScriptaApp.showToast('Você já disse essa');
    } else {
      ScriptaApp.showToast('Não está na categoria');
    }
  }

  function renderAnswers() {
    document.getElementById('category-answers').innerHTML = found.map((w) => `<span class="category-answer-chip">${escapeHtml(w)}</span>`).join('');
  }

  function finish() {
    ScriptaGameSession.finish({ correct: found.length, total: attempts || found.length });
  }

  return { start };
})();

// ==================== PALAVRA PROIBIDA (solo) ====================

const ScriptaGameTaboo = (() => {
  const ROUNDS_PER_SESSION = 3;
  const TIME_BY_DIFFICULTY = { facil: 40, medio: 35, dificil: 30 };
  let roundIndex = 0;
  let current = null;
  let wins = 0;

  async function start(gameId, difficulty) {
    roundIndex = 0;
    wins = 0;
    ScriptaGameSession.start(gameId, difficulty);
    await nextRound();
  }

  async function nextRound() {
    if (roundIndex >= ROUNDS_PER_SESSION) { ScriptaGameSession.finish({ correct: wins, total: ROUNDS_PER_SESSION }); return; }
    roundIndex += 1;
    document.getElementById('game-body').innerHTML = '<p class="tab-panel__hint">Preparando...</p>';
    current = await ScriptaGamesContent.getTabooChallenge(ScriptaGameSession.difficulty);
    render();
  }

  function render() {
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__hint">Rodada ${roundIndex} de ${ROUNDS_PER_SESSION} — explique esta palavra:</p>
        <p class="game-round-card__prompt">${escapeHtml(current.word)}</p>
        <div class="taboo-forbidden-list">
          ${current.forbidden.map((w) => `<span class="taboo-forbidden-chip">${escapeHtml(w)}</span>`).join('')}
        </div>
      </div>
      <textarea class="editor__textarea" id="taboo-input" style="min-height:120px;background:var(--bg-surface);border-radius:var(--radius-md);padding:var(--sp-3)"
        placeholder="Escreva sua explicação aqui, sem usar as palavras proibidas acima..."
        spellcheck="false" autocorrect="off" data-custom-keyboard inputmode="none"></textarea>
      <button type="button" class="btn btn-primary" id="taboo-submit" style="margin-top:var(--sp-3)">Confirmar explicação</button>
      <div class="game-feedback" id="taboo-feedback" hidden></div>
    `;
    if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.rescan();
    document.getElementById('taboo-submit').addEventListener('click', submit);
  }

  function submit() {
    const input = document.getElementById('taboo-input');
    const text = input.value.trim();
    if (!text) return;
    input.disabled = true;
    document.getElementById('taboo-submit').disabled = true;

    const lower = text.toLowerCase();
    const usedForbidden = current.forbidden.find((w) => lower.includes(w.toLowerCase()));
    const isCorrect = !usedForbidden && text.length > 8;
    if (isCorrect) wins += 1;

    ScriptaGameSession.recordAnswer(isCorrect);
    const el = document.getElementById('taboo-feedback');
    el.hidden = false;
    el.className = `game-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
    el.innerHTML = `
      ${isCorrect
        ? `<strong>✓ Mandou bem!</strong><p>Você explicou "${escapeHtml(current.word)}" sem usar nenhuma palavra proibida.</p>`
        : `<strong>✕ Ops</strong><p>${usedForbidden ? `Você usou a palavra proibida "${escapeHtml(usedForbidden)}".` : 'Escreva uma explicação um pouco mais completa.'}</p>`}
      <button type="button" class="btn btn-primary" id="taboo-continue" style="margin-top:var(--sp-3)">Continuar</button>
    `;
    document.getElementById('taboo-continue').addEventListener('click', nextRound);
  }

  return { start };
})();

// ==================== DESAFIO DE VELOCIDADE ====================

const ScriptaGameVelocidade = (() => {
  const TIME_BY_DIFFICULTY = { facil: 60, medio: 50, dificil: 45 };
  let words = [];
  let wordIndex = 0;
  let correct = 0;
  let total = 0;

  function start(gameId, difficulty) {
    ScriptaGameSession.start(gameId, difficulty);
    words = ScriptaGamesContent.getSpeedRoundWords(difficulty);
    wordIndex = 0;
    correct = 0;
    total = 0;
    renderRound();
    ScriptaGameSession.startTimer(TIME_BY_DIFFICULTY[difficulty] || 50, finish);
  }

  function renderRound() {
    if (wordIndex >= words.length) wordIndex = 0; // recicla a lista embaralhada se acabar
    const current = words[wordIndex];
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__hint">Palavra ${total + 1} — responda rápido!</p>
        <p class="game-round-card__prompt">${escapeHtml(current.clue)}</p>
      </div>
      <input type="text" class="game-typing-input" id="speed-input" placeholder="Sua resposta..." autocomplete="off"
        spellcheck="false" autocorrect="off" data-custom-keyboard inputmode="none">
      <button type="button" class="btn btn-primary" id="speed-submit">Confirmar</button>
    `;
    if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.rescan();
    const input = document.getElementById('speed-input');
    document.getElementById('speed-submit').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  function submit() {
    const input = document.getElementById('speed-input');
    const current = words[wordIndex];
    const isCorrect = input.value.trim().toLowerCase() === current.answer.toLowerCase();
    total += 1;
    if (isCorrect) correct += 1;
    ScriptaApp.showToast(isCorrect ? '✓' : `✕ Era "${current.answer}"`);
    wordIndex += 1;
    renderRound();
  }

  function finish() {
    ScriptaGameSession.finish({ correct, total: Math.max(total, 1) });
  }

  return { start };
})();

// ==================== PALAVRA DO DIA ====================

const ScriptaGameWordOfDay = (() => {
  let entry = null;
  let quizAnswered = false;

  function start(gameId, difficulty) {
    ScriptaGameSession.start(gameId, difficulty);
    entry = ScriptaGamesContent.getWordOfDay();
    quizAnswered = false;
    ScriptaStorage.setWordOfDaySeen();
    renderWord();
  }

  function renderWord() {
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card wordofday-card">
        <div class="wordofday-card__word">${escapeHtml(entry.word)}</div>
        <p class="wordofday-card__meaning">${escapeHtml(entry.meaning)}</p>
        <p class="wordofday-card__example">"${escapeHtml(entry.example)}"</p>
      </div>
      <button type="button" class="btn btn-primary" id="wordofday-challenge">Fazer o desafio</button>
    `;
    document.getElementById('wordofday-challenge').addEventListener('click', renderQuiz);
  }

  function renderQuiz() {
    const q = entry.quiz;
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__prompt">${escapeHtml(q.prompt)}</p>
      </div>
      <div class="game-options" id="wordofday-options">
        ${q.options.map((op) => `<button type="button" class="reading-option" data-answer="${escapeAttr(op)}">${escapeHtml(op)}</button>`).join('')}
      </div>
      <div class="game-feedback" id="wordofday-feedback" hidden></div>
    `;
    document.getElementById('wordofday-options').addEventListener('click', onAnswer);
  }

  function onAnswer(e) {
    if (quizAnswered) return;
    const btn = e.target.closest('[data-answer]');
    if (!btn) return;
    quizAnswered = true;

    const q = entry.quiz;
    const isCorrect = btn.dataset.answer === q.correctAnswer;
    document.querySelectorAll('#wordofday-options .reading-option').forEach((b) => {
      if (b.dataset.answer === q.correctAnswer) b.classList.add('is-correct');
      else if (b === btn) b.classList.add('is-wrong');
    });

    const el = document.getElementById('wordofday-feedback');
    el.hidden = false;
    el.className = `game-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
    el.innerHTML = `
      <strong>${isCorrect ? '✓ Certo!' : '✕ Quase'}</strong><p>${escapeHtml(q.explanation)}</p>
      <button type="button" class="btn btn-primary" id="wordofday-continue" style="margin-top:var(--sp-3)">Continuar</button>
    `;
    document.getElementById('wordofday-continue').addEventListener('click', () => {
      ScriptaGameSession.finish({ correct: isCorrect ? 1 : 0, total: 1 });
    });
  }

  return { start };
})();

// ==================== DESCUBRA A PALAVRA (dicas progressivas) ====================

const ScriptaGameReveal = (() => {
  const WORDS_PER_SESSION = 3;
  let wordIndex = 0;
  let current = null;
  let hintsShown = 1;
  let wins = 0;
  let answered = false;

  async function start(gameId, difficulty) {
    wordIndex = 0;
    wins = 0;
    ScriptaGameSession.start(gameId, difficulty);
    await nextWord();
  }

  async function nextWord() {
    if (wordIndex >= WORDS_PER_SESSION) { ScriptaGameSession.finish({ correct: wins, total: WORDS_PER_SESSION }); return; }
    wordIndex += 1;
    hintsShown = 1;
    answered = false;
    document.getElementById('game-body').innerHTML = '<p class="tab-panel__hint">Preparando...</p>';
    current = await ScriptaGamesContent.getRevealWord(ScriptaGameSession.difficulty);
    render();
  }

  function render() {
    document.getElementById('game-body').innerHTML = `
      <p class="tab-panel__hint" style="padding-top:0">Palavra ${wordIndex} de ${WORDS_PER_SESSION} — quanto menos dicas usar, melhor!</p>
      <div class="reveal-hints" id="reveal-hints"></div>
      <input type="text" class="game-typing-input" id="reveal-input" placeholder="Sua resposta..." autocomplete="off"
        spellcheck="false" autocorrect="off" data-custom-keyboard inputmode="none">
      <div class="editor__actions">
        <button type="button" class="btn btn-secondary" id="reveal-hint-btn">Mais uma dica</button>
        <button type="button" class="btn btn-primary" id="reveal-submit">Confirmar</button>
      </div>
      <div class="game-feedback" id="reveal-feedback" hidden></div>
    `;
    if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.rescan();
    renderHints();
    document.getElementById('reveal-hint-btn').addEventListener('click', addHint);
    document.getElementById('reveal-submit').addEventListener('click', submit);
    document.getElementById('reveal-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function renderHints() {
    const el = document.getElementById('reveal-hints');
    const shown = current.hints.slice(0, hintsShown);
    el.innerHTML = shown.map((h, i) => `<div class="reveal-hint-item">Dica ${i + 1}: ${escapeHtml(h)}</div>`).join('');
    document.getElementById('reveal-hint-btn').disabled = hintsShown >= current.hints.length;
  }

  function addHint() {
    if (hintsShown < current.hints.length) {
      hintsShown += 1;
      renderHints();
    }
  }

  function submit() {
    if (answered) return;
    const input = document.getElementById('reveal-input');
    if (!input.value.trim()) return;
    answered = true;

    const isCorrect = input.value.trim().toLowerCase() === current.word.toLowerCase();
    if (isCorrect) wins += 1;
    input.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
    input.disabled = true;

    const el = document.getElementById('reveal-feedback');
    el.hidden = false;
    el.className = `game-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
    el.innerHTML = `
      <strong>${isCorrect ? `✓ Certo, era mesmo "${escapeHtml(current.word)}"!` : `✕ Era "${escapeHtml(current.word)}"`}</strong>
      <p>Você usou ${hintsShown} de ${current.hints.length} dicas.</p>
      <button type="button" class="btn btn-primary" id="reveal-continue" style="margin-top:var(--sp-3)">Continuar</button>
    `;
    document.getElementById('reveal-continue').addEventListener('click', nextWord);
  }

  return { start };
})();
