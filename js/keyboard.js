/**
 * keyboard.js
 * -----------------------------------------------------------------------
 * Teclado virtual customizado, pra não depender do teclado nativo do
 * celular (que aplica corretor ortográfico e sublinha em vermelho).
 *
 * Como funciona:
 *   - Campos marcados com [data-custom-keyboard] recebem inputmode="none",
 *     o que impede o navegador de abrir o teclado nativo ao focar, mas
 *     mantém o campo focável/editável (cursor pisca normalmente).
 *   - Ao focar um desses campos, este teclado aparece fixo na base da
 *     tela e escreve diretamente no campo focado, na posição do cursor.
 *   - Segurar uma tecla com acento (a, e, i, o, u, c) abre um mini-popup
 *     com as variações, igual teclado nativo — solta o dedo em cima da
 *     variação desejada pra escolher, ou solta na própria tecla original
 *     sem arrastar pra digitar a letra normal.
 *   - Pode ser desligado em Perfil → Preferências, voltando ao teclado
 *     do celular (com inputmode normal).
 * -----------------------------------------------------------------------
 */

const ScriptaKeyboard = (() => {
  let activeField = null;
  let mode = 'letters'; // 'letters' | 'numbers'
  let shiftOn = true; // maiúscula na primeira letra por padrão
  let capsLock = false;
  let container = null;
  let bound = false;

  const ROWS_LETTERS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'],
  ];
  const ROWS_NUMBERS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', 'R$', '&', '@', '"'],
    ['#+=', '.', ',', '?', '!', "'", '⌫'],
  ];

  // Variações de acento por letra-base, na ordem em que aparecem no popup
  // de segurar-e-escolher. Só o que existe em português (nada de à francês
  // nem ñ espanhol fora do que a língua realmente usa).
  const ACCENT_MAP = {
    a: ['á', 'à', 'â', 'ã'],
    e: ['é', 'ê'],
    i: ['í'],
    o: ['ó', 'ô', 'õ'],
    u: ['ú'],
    c: ['ç'],
  };

  const LONG_PRESS_MS = 380;
  let pressTimer = null;
  let pressedKey = null;
  let popupEl = null;
  let popupOpen = false;
  let suppressNextClick = false;
  let openedThisGesture = false;

  function isEnabled() {
    const user = ScriptaStorage.getUser();
    return user.preferences?.customKeyboard !== false; // ligado por padrão
  }

  function buildKey(baseKey, displayText, extraClass = '') {
    return `<button type="button" class="kb-key ${extraClass}" data-key="${escapeAttr(baseKey)}">${displayText === ' ' ? '' : displayText}</button>`;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }

  function displayLabel(key) {
    if (mode !== 'letters') return key;
    if (key === '⇧' || key === '⌫') return key;
    return (shiftOn || capsLock) ? key.toUpperCase() : key;
  }

  function render() {
    const rows = mode === 'numbers' ? ROWS_NUMBERS : ROWS_LETTERS;

    const rowsHtml = rows.map((row, idx) => {
      const isMiddleRow = mode === 'letters' && idx === 1;
      const keys = row.map((k) => {
        const isSpecial = ['⇧', '⌫', '#+='].includes(k);
        const isShiftActive = k === '⇧' && (shiftOn || capsLock);
        const hasAccent = mode === 'letters' && ACCENT_MAP[k];
        return buildKey(k, displayLabel(k), `${isSpecial ? 'kb-key--special' : ''} ${isShiftActive ? 'is-active' : ''} ${hasAccent ? 'kb-key--has-accent' : ''}`);
      }).join('');
      return `<div class="kb-row ${isMiddleRow ? 'kb-row--indent' : ''}">${keys}</div>`;
    }).join('');

    const bottomRow = `
      <div class="kb-row kb-row--bottom">
        <button type="button" class="kb-key kb-key--special" data-action="toggle-mode">${mode === 'letters' ? '123' : 'ABC'}</button>
        <button type="button" class="kb-key kb-key--special" data-key=",">,</button>
        <button type="button" class="kb-key kb-key--space" data-key=" ">espaço</button>
        <button type="button" class="kb-key kb-key--special" data-action="enter">⏎</button>
      </div>`;

    container.innerHTML = `<div class="kb-keys">${rowsHtml}${bottomRow}</div>`;
  }

  function insertAtCursor(text) {
    if (!activeField) return;
    const el = activeField;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    const newPos = start + text.length;
    el.selectionStart = el.selectionEnd = newPos;
    el.dispatchEvent(new Event('input', { bubbles: true }));

    if (mode === 'letters' && shiftOn && !capsLock) {
      shiftOn = false;
      render();
    }
  }

  function backspace() {
    if (!activeField) return;
    const el = activeField;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === end && start > 0) {
      el.value = el.value.slice(0, start - 1) + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start - 1;
    } else {
      el.value = el.value.slice(0, start) + el.value.slice(end);
      el.selectionStart = el.selectionEnd = start;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---- Popup de acentos (segurar tecla) ----

  function showAccentPopup(baseKey, keyBtn) {
    hideAccentPopup();
    const useUpper = shiftOn || capsLock;
    const base = useUpper ? baseKey.toUpperCase() : baseKey;
    const variants = ACCENT_MAP[baseKey].map((v) => (useUpper ? v.toUpperCase() : v));
    const options = [base, ...variants];

    popupEl = document.createElement('div');
    popupEl.className = 'kb-accent-popup';
    popupEl.innerHTML = options.map((ch, i) => `
      <button type="button" class="kb-accent-popup__key ${i === 0 ? 'is-hover' : ''}" data-accent-key="${escapeAttr(ch)}">${ch}</button>
    `).join('');

    keyBtn.appendChild(popupEl);
    popupOpen = true;

    // Reposiciona se o popup for estourar a borda esquerda ou direita da
    // tela (acontece com teclas perto das bordas, tipo "q" ou "o"/"p").
    requestAnimationFrame(() => {
      if (!popupEl) return;
      const rect = popupEl.getBoundingClientRect();
      const margin = 4;
      let shift = 0;
      if (rect.left < margin) shift = margin - rect.left;
      else if (rect.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - rect.right;
      if (shift !== 0) popupEl.style.transform = `translateX(calc(-50% + ${shift}px))`;
    });
  }

  function hideAccentPopup() {
    if (popupEl) popupEl.remove();
    popupEl = null;
    popupOpen = false;
  }

  function updatePopupHover(clientX, clientY) {
    if (!popupEl) return;
    const el = document.elementFromPoint(clientX, clientY);
    const hovered = el && el.closest ? el.closest('.kb-accent-popup__key') : null;
    popupEl.querySelectorAll('.kb-accent-popup__key').forEach((k) => k.classList.remove('is-hover'));
    if (hovered) hovered.classList.add('is-hover');
    return hovered;
  }

  // ---- Ações e teclas normais (clique curto) ----

  function handleKeyClick(e) {
    if (suppressNextClick) { suppressNextClick = false; return; }

    // Se o popup de acentos estiver aberto, este clique decide o que
    // acontece com ele: tocar numa opção escolhe; tocar em qualquer outro
    // lugar só fecha o popup (sem executar a tecla de baixo), pra evitar
    // digitar algo sem querer.
    if (popupOpen) {
      const popupKeyBtn = e.target.closest('.kb-accent-popup__key');
      if (popupKeyBtn) insertAtCursor(popupKeyBtn.dataset.accentKey);
      hideAccentPopup();
      return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      if (action === 'toggle-mode') {
        mode = mode === 'letters' ? 'numbers' : 'letters';
        render();
      } else if (action === 'enter') {
        if (activeField && activeField.tagName === 'TEXTAREA') {
          insertAtCursor('\n');
        } else if (activeField) {
          activeField.form?.requestSubmit ? activeField.form.requestSubmit() : activeField.blur();
        }
      }
      return;
    }

    const keyBtn = e.target.closest('[data-key]');
    if (!keyBtn) return;
    const key = keyBtn.dataset.key;

    if (key === '⇧') {
      if (shiftOn && !capsLock) { capsLock = true; }
      else if (capsLock) { capsLock = false; shiftOn = false; }
      else { shiftOn = true; }
      render();
      return;
    }
    if (key === '⌫') { backspace(); return; }
    if (key === '#+=') { mode = 'numbers'; render(); return; }

    let charToInsert = key;
    if (mode === 'letters') {
      charToInsert = (shiftOn || capsLock) ? key.toUpperCase() : key;
    }
    insertAtCursor(charToInsert);
  }

  // ---- Pointer events: segurar abre o popup de acentos ----
  //
  // O popup NÃO se fecha sozinho ao soltar o dedo — fica aberto esperando
  // um toque separado (ver handleKeyClick acima). Isso é mais confiável em
  // celular de verdade do que depender de arrastar sem soltar, que às vezes
  // o navegador captura como rolagem da tela em vez de mandar pro app.
  // Arrastar até uma opção e soltar ali também funciona, como atalho extra.

  function onContainerPointerDown(e) {
    e.preventDefault(); // impede que o campo de texto perca o foco
    openedThisGesture = false; // reseta a cada novo toque

    const keyBtn = e.target.closest('.kb-key--has-accent[data-key]');
    if (!keyBtn) return;

    const baseKey = keyBtn.dataset.key;
    pressedKey = baseKey;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      showAccentPopup(baseKey, keyBtn);
      openedThisGesture = true;
    }, LONG_PRESS_MS);
  }

  function onContainerPointerMove(e) {
    if (!popupOpen) return;
    updatePopupHover(e.clientX, e.clientY);
  }

  function onContainerPointerUp(e) {
    clearTimeout(pressTimer);

    if (popupOpen) {
      // Atalho: se o usuário já tinha arrastado até uma opção antes de
      // soltar, escolhe ela direto — sem precisar de um segundo toque.
      const chosen = updatePopupHover(e.clientX, e.clientY);
      if (chosen) {
        insertAtCursor(chosen.dataset.accentKey);
        hideAccentPopup();
      }
      // Só suprime o clique sintético se ELE MESMO for o toque que acabou
      // de abrir o popup (senão o popup fecharia sozinho na hora). Se o
      // popup já estava aberto de um toque anterior, deixa o clique passar
      // pro handleKeyClick decidir (escolher a opção ou fechar o popup).
      if (openedThisGesture) suppressNextClick = true;
      pressedKey = null;
      return;
    }
    pressedKey = null;
  }

  function onContainerPointerCancel() {
    clearTimeout(pressTimer);
    hideAccentPopup();
    pressedKey = null;
  }

  function show(field) {
    if (!isEnabled()) return;
    activeField = field;
    shiftOn = true;
    capsLock = false;
    mode = 'letters';
    render();
    container.hidden = false;
    document.getElementById('bottom-nav').hidden = true;
  }

  function hide() {
    container.hidden = true;
    activeField = null;
    hideAccentPopup();
    // Os campos com teclado customizado só existem em telas que já mostram
    // a bottom-nav normalmente, então ao esconder o teclado ela sempre volta.
    document.getElementById('bottom-nav').hidden = false;
  }

  function bindFieldEvents() {
    document.querySelectorAll('[data-custom-keyboard]').forEach((field) => {
      if (field.dataset.kbBound) return;
      field.dataset.kbBound = '1';

      field.addEventListener('focus', () => show(field));
      // Redundância proposital: em alguns navegadores/webviews o evento de
      // foco pode não disparar de forma confiável ao tocar num campo com
      // inputmode="none". O clique direto garante que o teclado apareça de
      // qualquer forma.
      field.addEventListener('click', () => {
        if (container.hidden || activeField !== field) show(field);
      });
      // Não usar 'blur' direto pra esconder: o pointerdown no teclado já
      // previne o blur (ver bindOnce). O blur só esconde quando o usuário
      // realmente tocou fora do campo e do teclado.
      field.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.activeElement !== field && !container.contains(document.activeElement)) {
            hide();
          }
        }, 0);
      });
    });
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    container = document.getElementById('custom-keyboard');

    // pointerdown unifica mouse e toque (mais confiável do que separar
    // mousedown/touchstart, que podem se comportar de forma inconsistente
    // entre navegadores) — também é aqui que a contagem de "segurar" começa.
    container.addEventListener('pointerdown', onContainerPointerDown);
    container.addEventListener('pointermove', onContainerPointerMove);
    container.addEventListener('pointerup', onContainerPointerUp);
    container.addEventListener('pointercancel', onContainerPointerCancel);
    container.addEventListener('click', handleKeyClick);

    // Todos os campos já existem no DOM desde o carregamento da página
    // (as telas são <section> estáticas alternadas por CSS), então um único
    // bind no início já cobre tudo — sem precisar de MutationObserver.
    bindFieldEvents();
  }

  /** Chamado pelo Perfil ao ligar/desligar a preferência, pra aplicar na hora. */
  function applyPreference() {
    const enabled = isEnabled();
    document.querySelectorAll('[data-custom-keyboard]').forEach((field) => {
      if (enabled) {
        field.setAttribute('inputmode', 'none');
      } else {
        field.removeAttribute('inputmode');
        if (field === activeField) hide();
      }
    });
  }

  return { init: bindOnce, applyPreference, rescan: bindFieldEvents };
})();
