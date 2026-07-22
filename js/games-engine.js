/**
 * games-engine.js
 * -----------------------------------------------------------------------
 * Infraestrutura compartilhada dos minijogos: registro dos 19 jogos,
 * sessão (pontuação, timer, XP/moedas/nível ao final) e os dois motores
 * genéricos usados por boa parte deles — quiz (múltipla escolha) e
 * digitação (escrever a resposta). Os jogos com mecânica própria (forca,
 * memória, categorias, palavra proibida, velocidade, palavra do dia,
 * descubra a palavra) ficam em games-special.js.
 * -----------------------------------------------------------------------
 */

const GAME_DEFS = [
  { id: 'acentuacao', name: 'Acentuação', emoji: '✏️', family: 'typing', desc: 'Coloque os acentos certos nas palavras.' },
  { id: 'escrita-correta', name: 'Escrita Correta', emoji: '📝', family: 'typing', desc: 'A IA dá uma dica, você escreve a palavra.' },
  { id: 'forca', name: 'Jogo da Forca', emoji: '🎯', family: 'forca', desc: 'Descubra a palavra antes de completar a forca.' },
  { id: 'complete-palavra', name: 'Complete a Palavra', emoji: '🧩', family: 'typing', desc: 'Preencha as letras que faltam.' },
  { id: 'complete-frase', name: 'Complete a Frase', emoji: '💬', family: 'quiz', desc: 'Escolha a palavra certa pra frase.' },
  { id: 'sinonimos-antonimos', name: 'Sinônimos e Antônimos', emoji: '🔄', family: 'quiz', desc: 'Sentido igual ou oposto?' },
  { id: 'ortografia', name: 'Ortografia', emoji: '🔤', family: 'quiz', desc: 'Identifique a grafia correta.' },
  { id: 'correcao-erros', name: 'Correção de Erros', emoji: '🩹', family: 'typing', desc: 'Encontre e corrija os erros.' },
  { id: 'porque', name: 'Por Que / Porque', emoji: '❓', family: 'quiz', desc: 'Escolha a forma certa.' },
  { id: 'plural-singular', name: 'Plural e Singular', emoji: '🔢', family: 'typing', desc: 'Transforme as palavras.' },
  { id: 'mas-mais', name: 'Mas ou Mais', emoji: '⚖️', family: 'quiz', desc: 'Escolha a palavra certa.' },
  { id: 'mau-mal', name: 'Mau ou Mal', emoji: '⚖️', family: 'quiz', desc: 'Escolha a palavra certa.' },
  { id: 'verbos', name: 'Verbos', emoji: '🔀', family: 'typing', desc: 'Conjugue no tempo pedido.' },
  { id: 'descubra-palavra', name: 'Descubra a Palavra', emoji: '🔍', family: 'reveal', desc: 'Dicas progressivas até acertar.' },
  { id: 'memoria', name: 'Memória de Palavras', emoji: '🃏', family: 'memoria', desc: 'Encontre os pares relacionados.' },
  { id: 'categorias', name: 'Categorias', emoji: '📋', family: 'categorias', desc: 'Liste palavras a tempo.' },
  { id: 'palavra-proibida', name: 'Palavra Proibida', emoji: '🚫', family: 'taboo', desc: 'Explique sem as palavras proibidas.' },
  { id: 'desafio-velocidade', name: 'Desafio de Velocidade', emoji: '⚡', family: 'velocidade', desc: 'Quantas você acerta a tempo?' },
  { id: 'palavra-do-dia', name: 'Palavra do Dia', emoji: '📅', family: 'wordofday', desc: 'Uma palavra nova pra hoje.' },
];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// ---- Sessão: pontuação, timer, e o resumo final com XP/moedas/nível ----

const ScriptaGameSession = (() => {
  let gameId = null;
  let difficulty = 'facil';
  let correctCount = 0;
  let totalCount = 0;
  let timerInterval = null;
  let timerRemaining = 0;

  function start(id, diff) {
    gameId = id;
    difficulty = diff;
    correctCount = 0;
    totalCount = 0;
    document.getElementById('game-difficulty-bar').hidden = true;
    updateScoreHUD();
  }

  function recordAnswer(isCorrect) {
    totalCount += 1;
    if (isCorrect) correctCount += 1;
    updateScoreHUD();
  }

  function updateScoreHUD() {
    const el = document.getElementById('game-score');
    el.hidden = false;
    el.textContent = `${correctCount}/${totalCount}`;
  }

  function startTimer(seconds, onEnd) {
    stopTimer();
    timerRemaining = seconds;
    const timerEl = document.getElementById('game-timer');
    const valueEl = document.getElementById('game-timer-value');
    timerEl.hidden = false;
    valueEl.textContent = timerRemaining;
    timerEl.classList.remove('is-urgent');
    timerInterval = setInterval(() => {
      timerRemaining -= 1;
      valueEl.textContent = Math.max(0, timerRemaining);
      timerEl.classList.toggle('is-urgent', timerRemaining <= 5);
      if (timerRemaining <= 0) {
        stopTimer();
        if (onEnd) onEnd();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('game-timer').hidden = true;
  }

  function finish(extra = {}) {
    stopTimer();
    const total = extra.total ?? totalCount;
    const correct = extra.correct ?? correctCount;
    const result = ScriptaStorage.recordGameResult(gameId, { correct, total, difficulty });
    renderSummary(result, correct, total);
  }

  function renderSummary(result, correct, total) {
    const emoji = result.score >= 80 ? '🎉' : result.score >= 50 ? '👍' : '💪';
    const label = result.score >= 80 ? 'Excelente!' : result.score >= 50 ? 'Bom trabalho!' : 'Continue praticando!';

    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-summary">
        <div class="game-summary__emoji">${emoji}</div>
        <div class="game-summary__score">${result.score}%</div>
        <div class="game-summary__label">${label} ${correct}/${total} corretas</div>
        ${result.leveledUp ? `<div class="game-summary__levelup">🎊 Você subiu pro nível ${result.newLevel}!</div>` : ''}
        <div class="game-summary__rewards">
          <span>+${result.xpGained} XP</span>
          <span>+${result.coinsGained} 🪙</span>
        </div>
        <div class="editor__actions">
          <button type="button" class="btn btn-secondary" id="game-summary-exit">Voltar aos jogos</button>
          <button type="button" class="btn btn-primary" id="game-summary-again">Jogar de novo</button>
        </div>
      </div>
    `;
    document.getElementById('game-score').hidden = true;

    document.getElementById('game-summary-exit').addEventListener('click', () => ScriptaApp.navigate('games'));
    document.getElementById('game-summary-again').addEventListener('click', () => ScriptaGamesHub.playGame(gameId));

    if (result.newBadges && result.newBadges.length) {
      result.newBadges.forEach((b, i) => {
        setTimeout(() => ScriptaApp.showToast(`🏅 Nova conquista: ${b.label}`), 500 + i * 1600);
      });
    }
  }

  return {
    start, recordAnswer, startTimer, stopTimer, finish,
    get gameId() { return gameId; },
    get difficulty() { return difficulty; },
    get correctCount() { return correctCount; },
    get totalCount() { return totalCount; },
  };
})();

// ---- Motor genérico: QUIZ (múltipla escolha) ----

const ScriptaGameQuiz = (() => {
  const ROUNDS_PER_SESSION = 5;
  let roundIndex = 0;
  let currentRound = null;
  let answered = false;

  async function start(gameId, difficulty) {
    roundIndex = 0;
    ScriptaGameSession.start(gameId, difficulty);
    await nextRound();
  }

  async function nextRound() {
    if (roundIndex >= ROUNDS_PER_SESSION) { ScriptaGameSession.finish(); return; }
    roundIndex += 1;
    answered = false;
    document.getElementById('game-body').innerHTML = '<p class="tab-panel__hint">Preparando pergunta...</p>';
    currentRound = await ScriptaGamesContent.getQuizRound(ScriptaGameSession.gameId, ScriptaGameSession.difficulty);
    render();
  }

  function render() {
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__hint">Pergunta ${roundIndex} de ${ROUNDS_PER_SESSION}</p>
        <p class="game-round-card__prompt">${escapeHtml(currentRound.prompt)}</p>
      </div>
      <div class="game-options" id="quiz-options">
        ${currentRound.options.map((op) => `<button type="button" class="reading-option" data-answer="${escapeAttr(op)}">${escapeHtml(op)}</button>`).join('')}
      </div>
      <div class="game-feedback" id="quiz-feedback" hidden></div>
    `;
    document.getElementById('quiz-options').addEventListener('click', onOptionClick);
  }

  function onOptionClick(e) {
    if (answered) return;
    const btn = e.target.closest('[data-answer]');
    if (!btn) return;
    answered = true;

    const isCorrect = btn.dataset.answer === currentRound.correctAnswer;
    document.querySelectorAll('#quiz-options .reading-option').forEach((b) => {
      if (b.dataset.answer === currentRound.correctAnswer) b.classList.add('is-correct');
      else if (b === btn) b.classList.add('is-wrong');
    });
    ScriptaGameSession.recordAnswer(isCorrect);
    showFeedback(isCorrect);
  }

  function showFeedback(isCorrect) {
    const el = document.getElementById('quiz-feedback');
    el.hidden = false;
    el.className = `game-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
    el.innerHTML = `
      <strong>${isCorrect ? '✓ Certo!' : '✕ Não foi dessa vez'}</strong><p>${escapeHtml(currentRound.explanation)}</p>
      <button type="button" class="btn btn-primary" id="quiz-continue" style="margin-top:var(--sp-3)">Continuar</button>
    `;
    document.getElementById('quiz-continue').addEventListener('click', nextRound);
  }

  return { start };
})();

// ---- Motor genérico: DIGITAÇÃO (escrever a resposta) ----

const ScriptaGameTyping = (() => {
  const ROUNDS_PER_SESSION = 5;
  let roundIndex = 0;
  let currentRound = null;
  let answered = false;

  async function start(gameId, difficulty) {
    roundIndex = 0;
    ScriptaGameSession.start(gameId, difficulty);
    await nextRound();
  }

  async function nextRound() {
    if (roundIndex >= ROUNDS_PER_SESSION) { ScriptaGameSession.finish(); return; }
    roundIndex += 1;
    answered = false;
    document.getElementById('game-body').innerHTML = '<p class="tab-panel__hint">Preparando...</p>';
    currentRound = await ScriptaGamesContent.getTypingRound(ScriptaGameSession.gameId, ScriptaGameSession.difficulty);
    render();
  }

  function render() {
    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__hint">Pergunta ${roundIndex} de ${ROUNDS_PER_SESSION}</p>
        <p class="game-round-card__prompt">${escapeHtml(currentRound.prompt)}</p>
      </div>
      <input type="text" class="game-typing-input" id="typing-input" placeholder="Sua resposta..."
        autocomplete="off" spellcheck="false" autocorrect="off" data-custom-keyboard inputmode="none">
      <button type="button" class="btn btn-primary" id="typing-submit">Confirmar</button>
      <div class="game-feedback" id="typing-feedback" hidden></div>
    `;
    if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.rescan();
    document.getElementById('typing-submit').addEventListener('click', submit);
    document.getElementById('typing-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  function normalize(str) {
    return str.trim().toLowerCase();
  }

  function submit() {
    if (answered) return;
    const input = document.getElementById('typing-input');
    if (!input.value.trim()) return;
    answered = true;

    const isCorrect = normalize(input.value) === normalize(currentRound.correctAnswer);
    input.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
    input.disabled = true;
    ScriptaGameSession.recordAnswer(isCorrect);

    const el = document.getElementById('typing-feedback');
    el.hidden = false;
    el.className = `game-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
    el.innerHTML = `
      <strong>${isCorrect ? '✓ Certo!' : `✕ Resposta certa: "${escapeHtml(currentRound.correctAnswer)}"`}</strong><p>${escapeHtml(currentRound.explanation)}</p>
      <button type="button" class="btn btn-primary" id="typing-continue" style="margin-top:var(--sp-3)">Continuar</button>
    `;
    document.getElementById('typing-continue').addEventListener('click', nextRound);
  }

  return { start };
})();
