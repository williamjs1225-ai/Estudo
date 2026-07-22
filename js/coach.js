/**
 * coach.js
 * -----------------------------------------------------------------------
 * Tela "IA Coach": chat simples, com histórico persistido localmente.
 * -----------------------------------------------------------------------
 */

const ScriptaCoach = (() => {
  let bound = false;

  const WELCOME_MESSAGE = {
    role: 'assistant',
    content: 'Posso te ajudar a melhorar um texto, sugerir ideias, corrigir ou explicar regras de português. É só pedir!',
    ts: Date.now(),
  };

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderLog() {
    const log = document.getElementById('chat-log');
    const history = ScriptaStorage.getChatHistory();
    const messages = history.length ? history : [WELCOME_MESSAGE];

    log.innerHTML = messages.map((m) => `
      <div class="chat-bubble chat-bubble--${m.role}">${escapeHtml(m.content)}</div>
    `).join('');
    log.scrollTop = log.scrollHeight;
  }

  function appendTyping() {
    const log = document.getElementById('chat-log');
    const el = document.createElement('div');
    el.className = 'chat-bubble chat-bubble--assistant chat-bubble--typing';
    el.id = 'chat-typing';
    el.textContent = '···';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function removeTyping() {
    document.getElementById('chat-typing')?.remove();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    ScriptaStorage.appendChatMessage('user', text);
    input.value = '';
    renderLog();
    appendTyping();

    const history = ScriptaStorage.getChatHistory().map((m) => ({ role: m.role, content: m.content }));
    const reply = await ScriptaAI.chatReply(history);

    removeTyping();
    ScriptaStorage.appendChatMessage('assistant', reply.content);
    renderLog();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;
    document.getElementById('chat-form').addEventListener('submit', handleSubmit);
  }

  function render() {
    bindOnce();
    renderLog();
  }

  return { render };
})();
