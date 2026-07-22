/**
 * splash.js
 * -----------------------------------------------------------------------
 * Mantém a Splash Screen visível pelo tempo mínimo necessário para a
 * animação da assinatura terminar, então vai para a Home — este é um
 * PWA de uso pessoal, sem tela de login.
 *
 * Se o app foi aberto por um atalho da tela inicial (?action=...,
 * configurado em manifest.json > shortcuts), pula direto pra tela pedida
 * em vez de passar pela Home.
 * -----------------------------------------------------------------------
 */

(function initSplash() {
  const MIN_DISPLAY_MS = 2200;
  const startedAt = Date.now();

  const ACTION_TO_SCREEN = {
    'new-text': 'editor',
    'coach': 'coach',
    'exercises': 'exercises',
  };

  function goNext() {
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const action = new URLSearchParams(window.location.search).get('action');
    const targetScreen = ACTION_TO_SCREEN[action] || 'home';

    // Espera o banco (IndexedDB) terminar de carregar os dados salvos pro
    // cache em memória antes de mostrar qualquer tela — assim nenhuma tela
    // corre o risco de renderizar com dados "em branco" só porque o banco
    // ainda não tinha respondido.
    Promise.all([
      ScriptaStorage.ready(),
      new Promise((resolve) => setTimeout(resolve, wait)),
    ]).then(() => {
      ScriptaApp.navigate(targetScreen, { isEntry: true });
      // Limpa o ?action= da URL pra não repetir o atalho num refresh manual.
      if (action) window.history.replaceState({}, '', window.location.pathname);
    });
  }

  if (document.readyState === 'complete') {
    goNext();
  } else {
    window.addEventListener('load', goNext);
  }
})();
