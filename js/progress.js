/**
 * progress.js
 * -----------------------------------------------------------------------
 * Tela "Progresso": Plano de Estudo (checklist diário + foco da semana)
 * e Vocabulário (lista de palavras salvas + adicionar novas).
 * -----------------------------------------------------------------------
 */

const ScriptaProgress = (() => {
  let bound = false;
  let chartInstance = null;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderChart() {
    const canvas = document.getElementById('chart-words');
    if (!canvas || typeof Chart === 'undefined') return;

    const history = ScriptaStorage.getHistory().slice(-7);
    const labels = history.map((d) => {
      const date = new Date(`${d.date}T00:00:00`);
      return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
    });
    const values = history.map((d) => d.words);

    if (chartInstance) chartInstance.destroy();

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim();
    const textMuted = styles.getPropertyValue('--text-muted').trim();
    const borderSubtle = styles.getPropertyValue('--border-subtle').trim();

    chartInstance = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: accent,
          borderRadius: 6,
          maxBarThickness: 28,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} palavras` } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: textMuted, font: { size: 11 } } },
          y: { display: false, grid: { color: borderSubtle } },
        },
      },
    });
  }

  function renderChecklist() {
    const plan = ScriptaStorage.getPlan();
    const done = plan.daily.filter((i) => i.done).length;
    document.getElementById('plan-progress-label').textContent = `${done} de ${plan.daily.length} concluídos`;

    document.getElementById('plan-checklist').innerHTML = plan.daily.map((item) => `
      <li class="checklist__item ${item.done ? 'is-done' : ''}" data-plan-item="${item.id}">
        <span class="checklist__check">${item.done ? '✓' : ''}</span>
        <span class="checklist__label">${escapeHtml(item.label)}</span>
        <span class="checklist__status">${item.done ? 'Concluída' : 'Pendente'}</span>
      </li>
    `).join('');

    document.getElementById('plan-focus-text').textContent = plan.weekFocus.label;
    document.getElementById('plan-focus-bar').style.width = `${plan.weekFocus.pct}%`;
    document.getElementById('plan-focus-pct').textContent = `${plan.weekFocus.pct}%`;
  }

  function renderVocab() {
    const words = ScriptaStorage.getVocab();
    const list = document.getElementById('vocab-list');
    if (words.length === 0) {
      list.innerHTML = '<p class="tab-panel__hint">Nenhuma palavra salva ainda.</p>';
      return;
    }
    list.innerHTML = words.map((w) => `
      <li class="vocab-list__item">
        <strong>${escapeHtml(w.word)}</strong>
        <span>${escapeHtml(w.definition)}</span>
      </li>
    `).join('');
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById('plan-checklist').addEventListener('click', (e) => {
      const item = e.target.closest('[data-plan-item]');
      if (!item) return;
      ScriptaStorage.togglePlanItem(item.dataset.planItem);
      renderChecklist();
    });

    document.getElementById('vocab-add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('vocab-add-word');
      const word = input.value.trim();
      if (!word) return;
      ScriptaStorage.addVocabWord(word, 'Toque em "Analisar com IA" num texto que use essa palavra para gerar sinônimos e exemplos.');
      input.value = '';
      renderVocab();
      ScriptaApp.showToast('Palavra adicionada');
    });
  }

  function render() {
    bindOnce();
    renderChecklist();
    renderVocab();
    renderChart();
  }

  return { render };
})();
