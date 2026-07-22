/**
 * reading.js
 * -----------------------------------------------------------------------
 * Tela "Leitura": meta semanal, estatísticas, e a sessão de leitura
 * (texto curto + perguntas de interpretação).
 * -----------------------------------------------------------------------
 */

const ScriptaReading = (() => {
  let bound = false;
  let currentReading = null;
  let currentAnswers = [];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    bindOnce();

    const stats = ScriptaStorage.getStats();
    const reading = ScriptaStorage.getReadingState();

    document.getElementById('reading-goal-count').textContent = `${reading.weeklyDone}/${reading.weeklyGoal} textos por semana`;
    document.getElementById('reading-goal-bar').style.width = `${Math.min(100, (reading.weeklyDone / reading.weeklyGoal) * 100)}%`;

    document.getElementById('reading-stat-texts').textContent = stats.readingTextsCount;
    document.getElementById('reading-stat-time').textContent = formatMinutes(stats.readingMinutes);
    document.getElementById('reading-stat-comprehension').textContent = `${stats.readingComprehension}%`;
    document.getElementById('reading-summary-text').textContent = reading.lastSummary;
  }

  function formatMinutes(total) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function startReading() {
    ScriptaApp.showToast('Buscando um texto...');
    currentReading = await ScriptaAI.getReadingText();
    currentAnswers = new Array(currentReading.perguntas.length).fill(null);
    renderSession();
    ScriptaApp.navigate('reading-session');
  }

  function renderSession() {
    document.getElementById('reading-session-title').textContent = currentReading.titulo;
    document.getElementById('reading-session-text').textContent = currentReading.texto;

    document.getElementById('reading-session-questions').innerHTML = currentReading.perguntas.map((q, qi) => `
      <div class="glass-card reading-question">
        <p class="reading-question__prompt">${escapeHtml(q.pergunta)}</p>
        <div class="reading-question__options">
          ${q.opcoes.map((op, oi) => `
            <button type="button" class="reading-option" data-q="${qi}" data-o="${oi}">${escapeHtml(op)}</button>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function selectOption(qi, oi, btn) {
    currentAnswers[qi] = currentReading.perguntas[qi].opcoes[oi];
    btn.closest('.reading-question__options').querySelectorAll('.reading-option').forEach((b) => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
  }

  function submitSession() {
    if (currentAnswers.some((a) => a === null)) {
      ScriptaApp.showToast('Responda todas as perguntas antes de continuar');
      return;
    }
    const hits = currentReading.perguntas.filter((q, i) => q.resposta === currentAnswers[i]).length;
    const score = Math.round((hits / currentReading.perguntas.length) * 100);

    const stats = ScriptaStorage.getStats();
    const reading = ScriptaStorage.getReadingState();
    ScriptaStorage.patchStats({
      readingTextsCount: stats.readingTextsCount + 1,
      readingMinutes: stats.readingMinutes + 4,
      readingComprehension: Math.round((stats.readingComprehension + score) / 2),
    });
    ScriptaStorage.setReadingState({
      ...reading,
      weeklyDone: Math.min(reading.weeklyGoal, reading.weeklyDone + 1),
      lastSummary: `Você acertou ${hits} de ${currentReading.perguntas.length} perguntas em "${currentReading.titulo}". Continue assim!`,
    });
    ScriptaStorage.logDailyProgress({ accuracy: score });

    ScriptaApp.showToast(`Compreensão: ${score}%`);
    ScriptaApp.navigate('reading');
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById('reading-start').addEventListener('click', startReading);

    document.getElementById('reading-session-questions').addEventListener('click', (e) => {
      const btn = e.target.closest('.reading-option');
      if (!btn) return;
      selectOption(Number(btn.dataset.q), Number(btn.dataset.o), btn);
    });

    document.getElementById('reading-session-submit').addEventListener('click', submitSession);
  }

  return { render };
})();
