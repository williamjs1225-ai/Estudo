/**
 * games-hub.js
 * -----------------------------------------------------------------------
 * Tela "Minijogos": perfil (nível/XP/moedas), conquistas e a grade com os
 * 19 jogos. Também é quem despacha cada jogo pro motor certo (quiz,
 * digitação, ou um dos 7 especiais) depois que o jogador escolhe a
 * dificuldade.
 * -----------------------------------------------------------------------
 */

const ScriptaGamesHub = (() => {
  let bound = false;

  const ENGINE_BY_FAMILY = {
    quiz: ScriptaGameQuiz,
    typing: ScriptaGameTyping,
    forca: ScriptaGameForca,
    memoria: ScriptaGameMemoria,
    categorias: ScriptaGameCategorias,
    taboo: ScriptaGameTaboo,
    velocidade: ScriptaGameVelocidade,
    wordofday: ScriptaGameWordOfDay,
    reveal: ScriptaGameReveal,
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderProfile() {
    const games = ScriptaStorage.getGamesData();
    const xpIntoLevel = games.xp % 150;
    const CIRC = 2 * Math.PI * 24;

    document.getElementById('games-level-num').textContent = games.level;
    document.getElementById('games-level-label').textContent = `Nível ${games.level}`;
    document.getElementById('games-xp-label').textContent = `${games.xp} XP total`;
    document.getElementById('games-coins').textContent = games.coins;

    const ring = document.getElementById('games-level-ring');
    ring.style.strokeDasharray = CIRC;
    ring.style.strokeDashoffset = CIRC * (1 - xpIntoLevel / 150);

    const badgeDefs = ScriptaStorage.getBadgeDefs();
    document.getElementById('games-badges').innerHTML = badgeDefs.map((b) => {
      const unlocked = games.badges.includes(b.id);
      return `
        <div class="games-badges__item ${unlocked ? '' : 'is-locked'}" title="${escapeHtml(b.label)}">
          <span>${b.icon}</span>
          <span>${escapeHtml(b.label)}</span>
        </div>`;
    }).join('');
  }

  function renderGrid() {
    const games = ScriptaStorage.getGamesData();
    document.getElementById('games-grid').innerHTML = GAME_DEFS.map((def) => {
      const stats = games.perGame[def.id] || { bestScore: 0 };
      return `
        <button type="button" class="game-card" data-game-id="${def.id}">
          <span class="game-card__emoji">${def.emoji}</span>
          <span class="game-card__name">${escapeHtml(def.name)}</span>
          <span class="game-card__desc">${escapeHtml(def.desc)}</span>
          ${stats.bestScore > 0 ? `<span class="game-card__best">Recorde: ${stats.bestScore}%</span>` : ''}
        </button>`;
    }).join('');
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.getElementById('games-grid').addEventListener('click', (e) => {
      const card = e.target.closest('[data-game-id]');
      if (card) openDifficultyPicker(card.dataset.gameId);
    });
    document.getElementById('game-back').addEventListener('click', () => ScriptaApp.navigate('games'));
  }

  /** Abre a tela de jogo já na escolha de dificuldade, antes de começar a jogar. */
  function openDifficultyPicker(gameId) {
    const def = GAME_DEFS.find((g) => g.id === gameId);
    if (!def) return;

    ScriptaApp.navigate('game-play');
    document.getElementById('game-title').textContent = def.name;
    document.getElementById('game-score').hidden = true;
    document.getElementById('game-timer').hidden = true;

    const stats = ScriptaStorage.getGameStats(gameId);
    const bar = document.getElementById('game-difficulty-bar');
    bar.hidden = false;
    bar.querySelectorAll('.segmented__item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.gameDifficulty === stats.difficulty);
    });

    document.getElementById('game-body').innerHTML = `
      <div class="glass-card game-round-card">
        <p class="game-round-card__prompt">${def.emoji} ${escapeHtml(def.name)}</p>
        <p class="game-round-card__hint">${escapeHtml(def.desc)}</p>
      </div>
      <p class="tab-panel__hint">Escolha a dificuldade acima pra começar.</p>
    `;

    // Reatribui o clique da barra de dificuldade pra este jogo específico
    // (removendo qualquer handler de uma rodada anterior).
    const newBar = bar.cloneNode(true);
    bar.parentNode.replaceChild(newBar, bar);
    newBar.querySelectorAll('[data-game-difficulty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        newBar.querySelectorAll('.segmented__item').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const difficulty = btn.dataset.gameDifficulty;
        ScriptaStorage.setGameDifficulty(gameId, difficulty);
        newBar.hidden = true;
        playGame(gameId, difficulty);
      });
    });
  }

  function playGame(gameId, difficultyOverride) {
    const def = GAME_DEFS.find((g) => g.id === gameId);
    if (!def) return;
    const difficulty = difficultyOverride || ScriptaStorage.getGameStats(gameId).difficulty || 'facil';
    document.getElementById('game-difficulty-bar').hidden = true;
    document.getElementById('game-title').textContent = def.name;

    const engine = ENGINE_BY_FAMILY[def.family];
    if (!engine) {
      document.getElementById('game-body').innerHTML = '<p class="tab-panel__hint">Este jogo ainda está sendo preparado.</p>';
      return;
    }
    engine.start(gameId, difficulty);
  }

  function render() {
    bindOnce();
    renderProfile();
    renderGrid();
  }

  return { render, playGame };
})();
