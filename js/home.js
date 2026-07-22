/**
 * home.js
 * -----------------------------------------------------------------------
 * Preenche a tela Home com dados do usuário/estatísticas e busca a
 * sugestão diária da IA. Roda toda vez que a Home é aberta, pois os
 * números mudam conforme o uso de outras telas (Escrita, Leitura, Plano).
 * -----------------------------------------------------------------------
 */

const ScriptaHome = (() => {
  let bound = false;
  let tipRequestToken = 0;

  const WEEKDAY_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']; // Seg..Dom

  function renderWeekDots(weekActivity) {
    const container = document.getElementById('home-week-dots');
    container.innerHTML = WEEKDAY_LETTERS.map((letter, i) => {
      const done = Boolean(weekActivity[i]);
      return `
        <div class="week-dot">
          <span class="week-dot__letter">${letter}</span>
          <span class="week-dot__circle ${done ? 'is-done' : ''}">${done ? '✓' : ''}</span>
        </div>`;
    }).join('');
  }

  function formatDate(date) {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function formatRelativeTime(timestamp) {
    const diffMs = Date.now() - timestamp;
    const diffH = Math.round(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return 'há poucos minutos';
    if (diffH === 1) return 'há 1 hora';
    if (diffH < 24) return `há ${diffH} horas`;
    return `há ${Math.round(diffH / 24)} dia(s)`;
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById('ai-suggestion-dismiss').addEventListener('click', (e) => {
      e.stopPropagation(); // não deve disparar a navegação do card
      document.getElementById('ai-suggestion-card').style.display = 'none';
    });

    // O card "Continuar" abre o texto real no editor, em vez de só navegar.
    document.getElementById('continue-card').addEventListener('click', (e) => {
      const recent = ScriptaStorage.getRecentText();
      if (recent && typeof ScriptaEditor !== 'undefined') {
        e.preventDefault();
        ScriptaApp.navigate('editor');
        ScriptaEditor.openText(recent.id);
      }
    });
  }

  function render() {
    bindOnce();

    const user = ScriptaStorage.getUser();
    const stats = ScriptaStorage.getStats();
    const recent = ScriptaStorage.getRecentText();

    document.getElementById('home-date').textContent = formatDate(new Date());
    document.getElementById('home-username').textContent = user.name || 'Escritor(a)';
    document.getElementById('home-avatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

    document.getElementById('home-streak').textContent = stats.streakDays;
    renderWeekDots(stats.weekActivity);

    document.getElementById('stat-words').textContent = stats.wordsTotal.toLocaleString('pt-BR');
    document.getElementById('stat-words-delta').textContent = stats.wordsDelta;
    document.getElementById('stat-texts').textContent = stats.textsTotal.toLocaleString('pt-BR');
    document.getElementById('stat-texts-delta').textContent = stats.textsDelta;
    document.getElementById('stat-vocab').textContent = stats.vocabLearned.toLocaleString('pt-BR');
    document.getElementById('stat-vocab-delta').textContent = stats.vocabDelta;

    if (recent) {
      document.getElementById('recent-title').textContent = recent.title;
      document.getElementById('recent-time').textContent = formatRelativeTime(recent.updatedAt);
      document.getElementById('recent-words').textContent = `${recent.words.toLocaleString('pt-BR')} palavras`;
    }

    const thisRequest = ++tipRequestToken;
    ScriptaAI.getDailyTip().then(({ tip }) => {
      if (thisRequest !== tipRequestToken) return; // uma renderização mais nova já disparou outro pedido
      document.getElementById('home-ai-tip').textContent = tip;
    });
  }

  return { render };
})();
