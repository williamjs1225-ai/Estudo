/**
 * exercises.js
 * -----------------------------------------------------------------------
 * Tela "Exercícios": escolhe um tipo, a IA gera a pergunta, o usuário
 * responde e recebe explicação. O nível de dificuldade sobe a cada 3
 * acertos seguidos e desce a cada 2 erros seguidos.
 * -----------------------------------------------------------------------
 */

const ScriptaExercises = (() => {
  let bound = false;
  let currentExercise = null;
  let answered = false;

  const TYPES = [
    'gramatica', 'ortografia', 'concordancia', 'pontuacao',
    'sinonimos', 'antonimos', 'vocabulario', 'interpretacao',
    'completar_frases', 'corrigir_erros',
  ];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderTypeGrid() {
    const state = ScriptaStorage.getExerciseState();
    document.getElementById('exercises-level').textContent = `Nível ${state.level} de 5`;
    document.getElementById('exercises-completed').textContent = `${state.completed} concluídos`;

    document.getElementById('exercises-type-grid').innerHTML = TYPES.map((type) => `
      <button type="button" class="exercise-type-chip" data-type="${type}">
        ${escapeHtml(ScriptaAI.exerciseLabels[type])}
      </button>
    `).join('');
  }

  async function startExercise(type) {
    answered = false;
    document.getElementById('exercises-question-area').hidden = false;
    document.getElementById('exercises-type-grid-wrap').hidden = true;
    document.getElementById('exercises-question-card').innerHTML = '<p class="tab-panel__hint">Gerando exercício...</p>';
    document.getElementById('exercises-feedback').hidden = true;

    const state = ScriptaStorage.getExerciseState();
    currentExercise = await ScriptaAI.generateExercise(type, state.level);
    renderQuestion(type);
  }

  function renderQuestion(type) {
    document.getElementById('exercises-question-card').innerHTML = `
      <span class="badge">${escapeHtml(ScriptaAI.exerciseLabels[type])}</span>
      <p class="reading-question__prompt" style="margin-top: var(--sp-3)">${escapeHtml(currentExercise.pergunta)}</p>
      <div class="reading-question__options" id="exercises-options">
        ${currentExercise.opcoes.map((op) => `
          <button type="button" class="reading-option" data-answer="${escapeHtml(op)}">${escapeHtml(op)}</button>
        `).join('')}
      </div>
    `;
  }

  function selectAnswer(answer, btn) {
    if (answered) return;
    answered = true;

    const correct = answer === currentExercise.resposta;
    document.querySelectorAll('#exercises-options .reading-option').forEach((b) => {
      b.classList.remove('is-selected');
      if (b.dataset.answer === currentExercise.resposta) b.classList.add('is-correct');
      else if (b === btn) b.classList.add('is-wrong');
    });

    ScriptaStorage.registerExerciseResult(correct);

    const feedback = document.getElementById('exercises-feedback');
    feedback.hidden = false;
    feedback.className = `glass-card exercise-feedback ${correct ? 'is-correct' : 'is-wrong'}`;
    feedback.innerHTML = `
      <strong>${correct ? '✓ Certo!' : '✕ Quase — a resposta certa era "' + escapeHtml(currentExercise.resposta) + '"'}</strong>
      <p>${escapeHtml(currentExercise.explicacao)}</p>
    `;
  }

  function backToTypes() {
    document.getElementById('exercises-question-area').hidden = true;
    document.getElementById('exercises-type-grid-wrap').hidden = false;
    renderTypeGrid();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById('exercises-type-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (btn) startExercise(btn.dataset.type);
    });

    document.getElementById('exercises-question-card').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-answer]');
      if (btn) selectAnswer(btn.dataset.answer, btn);
    });

    document.getElementById('exercises-back').addEventListener('click', backToTypes);

    document.getElementById('exercises-next').addEventListener('click', () => {
      if (currentExercise) {
        const type = document.querySelector('#exercises-question-card .badge')?.textContent;
        const typeKey = Object.keys(ScriptaAI.exerciseLabels).find((k) => ScriptaAI.exerciseLabels[k] === type) || 'gramatica';
        startExercise(typeKey);
      }
    });
  }

  function render() {
    bindOnce();
    document.getElementById('exercises-question-area').hidden = true;
    document.getElementById('exercises-type-grid-wrap').hidden = false;
    renderTypeGrid();
  }

  return { render };
})();
