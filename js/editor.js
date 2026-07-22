/**
 * editor.js
 * -----------------------------------------------------------------------
 * Tela "Escrita": novo texto, lista de textos salvos, desafios, e a
 * ponte para a tela de Análise com IA.
 * -----------------------------------------------------------------------
 */

const ScriptaEditor = (() => {
  let bound = false;
  let currentTextId = null;
  let focusMode = false;

  const CHALLENGES = [
    'Descreva um momento em que você mudou de ideia sobre algo importante.',
    'Escreva uma carta para você mesmo(a) daqui a 5 anos.',
    'Conte uma história curta que comece com "A porta estava entreaberta."',
    'Explique um conceito difícil como se fosse para uma criança de 10 anos.',
  ];

  // Palavras muito comuns que não fazem sentido destacar mesmo se repetidas.
  const STOPWORDS = new Set([
    'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'uma', 'para', 'com',
    'não', 'os', 'as', 'dos', 'das', 'ao', 'aos', 'à', 'às', 'se', 'na', 'no',
    'nas', 'nos', 'por', 'mais', 'como', 'mas', 'foi', 'ele', 'ela', 'eles',
    'elas', 'você', 'eu', 'tu', 'nós', 'isso', 'isto', 'aquilo', 'essa', 'esse',
    'essas', 'esses', 'esta', 'este', 'estas', 'estes', 'já', 'também', 'muito',
    'bem', 'quando', 'onde', 'porque', 'então', 'assim', 'ainda', 'só', 'sobre',
    'entre', 'até', 'depois', 'antes', 'sem', 'sob', 'pela', 'pelo', 'pelas',
    'pelos', 'sua', 'seu', 'suas', 'seus', 'minha', 'meu', 'minhas', 'meus',
    'nossa', 'nosso', 'nossas', 'nossos', 'ser', 'estar', 'ter', 'é', 'são',
    'está', 'estão', 'era', 'tinha', 'há', 'lhe', 'lhes', 'me', 'te', 'vos',
    'qual', 'quais', 'quem', 'cujo', 'cuja', 'todo', 'toda', 'todos', 'todas',
  ]);

  const titleInput = () => document.getElementById('editor-title');
  const bodyInput = () => document.getElementById('editor-body');
  const wordCountEl = () => document.getElementById('editor-word-count');

  function countWords(text) {
    return (text.trim().match(/\S+/g) || []).length;
  }

  function updateWordCount() {
    wordCountEl().textContent = `${countWords(bodyInput().value)} palavras`;
  }

  function wrapSelection(prefix, suffix) {
    const el = bodyInput();
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end) || 'texto';
    el.value = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
    el.focus();
    el.selectionStart = start + prefix.length;
    el.selectionEnd = start + prefix.length + selected.length;
    updateWordCount();
    updateHighlight();
  }

  function resetEditor() {
    currentTextId = null;
    titleInput().value = '';
    bodyInput().value = '';
    updateWordCount();
    updateHighlight();
  }

  function switchToNewTextTab() {
    document.querySelector('#screen-editor .segmented__item[data-tab="editor-new"]').click();
  }

  function saveCurrent({ silent = false } = {}) {
    const title = titleInput().value.trim() || 'Sem título';
    const content = bodyInput().value;
    const newWordCount = countWords(content);
    const previousWordCount = currentTextId ? (ScriptaStorage.getText(currentTextId)?.words || 0) : 0;

    const saved = ScriptaStorage.saveText({
      id: currentTextId,
      title,
      content,
      words: newWordCount,
    });
    currentTextId = saved.id;

    // Mantém as estatísticas da Home coerentes com os textos reais salvos.
    const allTexts = ScriptaStorage.getTexts();
    ScriptaStorage.patchStats({
      wordsTotal: allTexts.reduce((sum, t) => sum + t.words, 0),
      textsTotal: allTexts.length,
    });

    // Alimenta o histórico usado nos gráficos de evolução (só soma o que foi escrito de novo).
    const delta = Math.max(0, newWordCount - previousWordCount);
    if (delta > 0) ScriptaStorage.logDailyProgress({ words: delta });

    if (!silent) ScriptaApp.showToast('Texto salvo');
    return saved;
  }

  /** Abre um texto existente para edição (chamado pelo card "Continuar" na Home). */
  function openText(id) {
    const text = ScriptaStorage.getText(id);
    if (!text) return;
    currentTextId = text.id;
    titleInput().value = text.title;
    bodyInput().value = text.content || '';
    updateWordCount();
    updateHighlight();
    switchToNewTextTab();
  }

  function renderTextList() {
    const list = document.getElementById('editor-text-list');
    const texts = ScriptaStorage.getTexts();
    if (texts.length === 0) {
      list.innerHTML = '<p class="tab-panel__hint">Você ainda não salvou nenhum texto.</p>';
      return;
    }
    list.innerHTML = texts.map((t) => `
      <li class="text-list__item" data-open-text="${t.id}">
        <div class="text-list__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
        </div>
        <div class="text-list__body">
          <h3>${escapeHtml(t.title)}</h3>
          <p>${t.words} palavras · ${new Date(t.updatedAt).toLocaleDateString('pt-BR')}</p>
        </div>
      </li>
    `).join('');
  }

  function renderChallenges() {
    const list = document.getElementById('editor-challenge-list');
    list.innerHTML = CHALLENGES.map((c, i) => `
      <li class="challenge-list__item" data-challenge="${i}">
        <span>✦</span>
        <p>${escapeHtml(c)}</p>
      </li>
    `).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Encontra palavras (4+ letras, fora da lista de stopwords) que aparecem 3+ vezes no texto. */
  function findRepeatedWords(text) {
    const counts = {};
    const matches = text.toLowerCase().match(/[a-zà-ü]+/gi) || [];
    matches.forEach((w) => {
      if (w.length < 4 || STOPWORDS.has(w)) return;
      counts[w] = (counts[w] || 0) + 1;
    });
    return Object.keys(counts).filter((w) => counts[w] >= 3);
  }

  /** Reconstrói a camada de destaque por trás do textarea, marcando as palavras repetidas. */
  function updateHighlight() {
    const text = bodyInput().value;
    const layer = document.getElementById('editor-highlight-layer');
    const repeated = findRepeatedWords(text);

    let html = escapeHtml(text);
    if (repeated.length > 0) {
      const WORD_CHARS = 'a-zà-üA-ZÀ-Ü0-9_';
      const pattern = new RegExp(`(?<![${WORD_CHARS}])(${repeated.map(escapeRegex).join('|')})(?![${WORD_CHARS}])`, 'giu');
      html = html.replace(pattern, (m) => `<mark class="repeated-word">${m}</mark>`);
    }
    // Quebra de linha extra no final pra camada acompanhar o textarea quando o cursor está na última linha.
    layer.innerHTML = html + '\n';
    layer.scrollTop = bodyInput().scrollTop;
  }

  function toggleFocusMode(forceOn) {
    focusMode = forceOn !== undefined ? forceOn : !focusMode;
    document.getElementById('screen-editor').classList.toggle('is-focus-mode', focusMode);
    document.getElementById('editor-focus-exit').hidden = !focusMode;
    document.getElementById('bottom-nav').hidden = focusMode;
  }

  function renderAnalysis(analysis) {
    document.getElementById('analysis-score-value').textContent = analysis.score;
    document.getElementById('analysis-label').textContent = analysis.label;
    document.getElementById('analysis-description').textContent = analysis.description;

    const CIRC = 2 * Math.PI * 38;
    const ring = document.getElementById('analysis-ring');
    ring.style.strokeDasharray = CIRC;
    ring.style.strokeDashoffset = CIRC * (1 - analysis.score / 100);

    const m = analysis.metrics;
    const rows = [
      ['Erros corrigidos', m.errosCorrigidos],
      ['Melhorias de estilo', m.melhoriasEstilo],
      ['Palavras avançadas usadas', m.palavrasAvancadas],
      ['Coerência', `${m.coerencia}%`],
      ['Clareza', `${m.clareza}%`],
      ['Originalidade', `${m.originalidade}%`],
    ];
    document.getElementById('analysis-metrics').innerHTML = rows.map(([label, value]) => `
      <li class="metric-list__item"><span>${label}</span><strong>${value}</strong></li>
    `).join('');
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    bodyInput().addEventListener('input', () => {
      updateWordCount();
      updateHighlight();
    });
    bodyInput().addEventListener('scroll', () => {
      document.getElementById('editor-highlight-layer').scrollTop = bodyInput().scrollTop;
    });

    document.getElementById('editor-focus-toggle').addEventListener('click', () => toggleFocusMode());
    document.getElementById('editor-focus-exit').addEventListener('click', () => toggleFocusMode(false));

    document.querySelectorAll('#screen-editor .btn-format').forEach((btn) => {
      btn.addEventListener('click', () => {
        const map = { bold: ['**', '**'], italic: ['_', '_'], underline: ['__', '__'] };
        const [prefix, suffix] = map[btn.dataset.format];
        wrapSelection(prefix, suffix);
      });
    });

    document.getElementById('editor-save').addEventListener('click', () => saveCurrent());

    document.getElementById('editor-analyze').addEventListener('click', async () => {
      const content = bodyInput().value.trim();
      if (!content) {
        ScriptaApp.showToast('Escreva algo antes de analisar');
        return;
      }
      saveCurrent({ silent: true });
      ScriptaApp.showToast('Analisando com IA...');
      const analysis = await ScriptaAI.analyzeText(content);
      renderAnalysis(analysis);
      ScriptaApp.navigate('analysis');
    });

    document.getElementById('editor-text-list').addEventListener('click', (e) => {
      const item = e.target.closest('[data-open-text]');
      if (item) openText(item.dataset.openText);
    });

    document.getElementById('editor-challenge-list').addEventListener('click', (e) => {
      const item = e.target.closest('[data-challenge]');
      if (!item) return;
      resetEditor();
      titleInput().value = CHALLENGES[Number(item.dataset.challenge)];
      switchToNewTextTab();
      bodyInput().focus();
    });
  }

  function render() {
    bindOnce();
    renderTextList();
    renderChallenges();
    updateWordCount();
    updateHighlight();
  }

  return { render, openText };
})();
