/**
 * profile.js
 * -----------------------------------------------------------------------
 * Tela "Perfil": nome, meta diária, preferências e limpeza de dados
 * locais (não há conta/login — tudo vive neste dispositivo).
 * -----------------------------------------------------------------------
 */

const ScriptaProfile = (() => {
  let bound = false;

  const PROVIDER_HINTS = {
    groq: 'Consiga uma chave gratuita em console.groq.com/keys',
    openai: 'Consiga sua chave em platform.openai.com/api-keys',
    gemini: 'Consiga sua chave em aistudio.google.com/apikey',
  };

  function saveField(patch) {
    ScriptaStorage.setUser({ ...ScriptaStorage.getUser(), ...patch });
  }

  function updateProviderHint() {
    const provider = document.getElementById('profile-ai-provider').value;
    document.getElementById('profile-ai-hint').textContent = PROVIDER_HINTS[provider] || '';
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.getElementById('profile-name').addEventListener('change', (e) => {
      saveField({ name: e.target.value.trim() || 'Escritor(a)' });
      ScriptaApp.showToast('Nome atualizado');
    });

    document.getElementById('profile-goal').addEventListener('change', (e) => {
      const value = Math.max(50, Number(e.target.value) || 500);
      e.target.value = value;
      saveField({ goalDailyWords: value });
      ScriptaApp.showToast('Meta diária atualizada');
    });

    document.getElementById('profile-notifications').addEventListener('change', (e) => {
      const user = ScriptaStorage.getUser();
      saveField({ preferences: { ...user.preferences, notifications: e.target.checked } });
    });

    document.getElementById('profile-custom-keyboard').addEventListener('change', (e) => {
      const user = ScriptaStorage.getUser();
      saveField({ preferences: { ...user.preferences, customKeyboard: e.target.checked } });
      if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.applyPreference();
      ScriptaApp.showToast(e.target.checked ? 'Teclado customizado ativado' : 'Voltando pro teclado do celular');
    });

    document.getElementById('profile-ai-provider').addEventListener('change', updateProviderHint);

    document.getElementById('profile-ai-save').addEventListener('click', () => {
      const provider = document.getElementById('profile-ai-provider').value;
      const apiKey = document.getElementById('profile-ai-key').value.trim();
      ScriptaStorage.setAIConfig({ provider, apiKey });
      document.getElementById('profile-ai-status').textContent = '';
      ScriptaApp.showToast(apiKey ? 'Chave salva' : 'Chave removida — a IA volta a usar respostas simuladas');
    });

    document.getElementById('profile-ai-test').addEventListener('click', async () => {
      const statusEl = document.getElementById('profile-ai-status');
      const provider = document.getElementById('profile-ai-provider').value;
      const apiKey = document.getElementById('profile-ai-key').value.trim();
      if (!apiKey) {
        statusEl.textContent = 'Cole uma chave antes de testar.';
        return;
      }
      ScriptaStorage.setAIConfig({ provider, apiKey });
      statusEl.textContent = 'Testando...';
      try {
        await ScriptaAI.testConnection();
        statusEl.textContent = '✓ Conectado! A IA já está funcionando de verdade.';
      } catch (err) {
        statusEl.textContent = `✕ Falhou: ${err.message}. Confira a chave e o provedor selecionado.`;
      }
    });

    document.getElementById('profile-reset').addEventListener('click', () => {
      const confirmed = window.confirm('Isso apaga todos os textos, vocabulário, progresso e a chave de IA salvos neste dispositivo. Continuar?');
      if (!confirmed) return;
      ScriptaStorage.clearAll();
      window.location.reload();
    });
  }

  function render() {
    bindOnce();
    const user = ScriptaStorage.getUser();
    document.getElementById('profile-avatar').textContent = user.avatarEmoji || '✍️';
    document.getElementById('profile-name').value = user.name;
    document.getElementById('profile-goal').value = user.goalDailyWords;
    document.getElementById('profile-notifications').checked = Boolean(user.preferences?.notifications);
    document.getElementById('profile-custom-keyboard').checked = user.preferences?.customKeyboard !== false;

    const aiConfig = ScriptaStorage.getAIConfig();
    document.getElementById('profile-ai-provider').value = aiConfig.provider || 'groq';
    document.getElementById('profile-ai-key').value = aiConfig.apiKey || '';
    document.getElementById('profile-ai-status').textContent = '';
    updateProviderHint();
  }

  return { render };
})();
