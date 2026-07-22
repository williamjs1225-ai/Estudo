/**
 * app.js
 * -----------------------------------------------------------------------
 * Router leve (sem framework) que alterna entre <section class="screen">.
 * Controla a bottom nav (incluindo o botão flutuante central) e delega
 * para o módulo de cada tela renderizar seus dados quando ela é aberta.
 * -----------------------------------------------------------------------
 */

const ScriptaApp = (() => {
  // Telas que mostram a bottom nav. "analysis" e "reading-session" são
  // sub-telas de foco (com botão de voltar) e não entram aqui de propósito.
  const SCREENS_WITH_NAV = ['home', 'editor', 'coach', 'progress', 'profile', 'reading', 'exercises', 'games'];

  // Módulo responsável por popular cada tela na primeira visita (ou sempre,
  // se a tela precisar refletir mudanças feitas em outra aba).
  // Usamos identificadores "soltos" (não window.X) porque const/let no topo
  // de um <script> não vira propriedade de window — só de var/function.
  const SCREEN_RENDERERS = {
    home: () => typeof ScriptaHome !== 'undefined' && ScriptaHome.render(),
    editor: () => typeof ScriptaEditor !== 'undefined' && ScriptaEditor.render(),
    coach: () => typeof ScriptaCoach !== 'undefined' && ScriptaCoach.render(),
    exercises: () => typeof ScriptaExercises !== 'undefined' && ScriptaExercises.render(),
    reading: () => typeof ScriptaReading !== 'undefined' && ScriptaReading.render(),
    progress: () => typeof ScriptaProgress !== 'undefined' && ScriptaProgress.render(),
    profile: () => typeof ScriptaProfile !== 'undefined' && ScriptaProfile.render(),
    games: () => typeof ScriptaGamesHub !== 'undefined' && ScriptaGamesHub.render(),
  };

  const bottomNav = document.getElementById('bottom-nav');
  let toastTimer = null;

  function navigate(screenName, { isEntry = false } = {}) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('is-active'));
    const target = document.getElementById(`screen-${screenName}`);
    if (!target) {
      console.warn('[ScriptaApp] tela desconhecida:', screenName);
      return;
    }
    target.classList.add('is-active');

    const showNav = SCREENS_WITH_NAV.includes(screenName);
    bottomNav.hidden = !showNav;

    if (showNav) {
      document.querySelectorAll('.nav-item').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.nav === screenName);
      });
    }

    if (SCREEN_RENDERERS[screenName]) SCREEN_RENDERERS[screenName]();

    if (!isEntry) window.scrollTo(0, 0);
  }

  function showToast(message, duration = 2400) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
  }

  function bindNavClicks() {
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(el.dataset.nav);
      });
    });
  }

  /** Controles segmentados (abas dentro de uma tela: Novo texto/Meus textos/Desafios etc). */
  function bindSegmentedControls() {
    document.querySelectorAll('.segmented').forEach((segmented) => {
      segmented.addEventListener('click', (e) => {
        const btn = e.target.closest('.segmented__item');
        if (!btn) return;

        segmented.querySelectorAll('.segmented__item').forEach((item) => item.classList.remove('is-active'));
        btn.classList.add('is-active');

        const screen = segmented.closest('.screen');
        const targetId = btn.dataset.tab;
        screen.querySelectorAll('.tab-panel').forEach((panel) => {
          panel.classList.toggle('is-active', panel.id === targetId);
        });
      });
    });
  }

  bindNavClicks();
  bindSegmentedControls();
  if (typeof ScriptaKeyboard !== 'undefined') ScriptaKeyboard.init();

  return { navigate, showToast };
})();

// Registro do Service Worker (offline + instalação como PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('[Scripta] falha ao registrar service worker:', err);
    });
  });
}
