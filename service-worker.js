/**
 * service-worker.js
 * -----------------------------------------------------------------------
 * Estratégia: "app shell" em cache (HTML/CSS/JS/ícones) servido primeiro
 * para carregamento instantâneo + funcionamento offline; chamadas a /api
 * sempre vão para a rede, pois envolvem dados dinâmicos da IA.
 *
 * Requisições cross-origin (Groq/OpenAI/Gemini, quando você configura sua
 * própria chave) são ignoradas de propósito — o service worker não deve
 * cachear nem intermediar respostas de IA, que são únicas a cada chamada.
 *
 * Ao publicar uma nova versão, incremente CACHE_VERSION para que o
 * navegador baixe os arquivos atualizados automaticamente.
 * -----------------------------------------------------------------------
 */

const CACHE_VERSION = 'scripta-v6';
const APP_SHELL = [
  '/index.html',
  '/manifest.json',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/screens.css',
  '/js/app.js',
  '/js/splash.js',
  '/js/home.js',
  '/js/editor.js',
  '/js/coach.js',
  '/js/exercises.js',
  '/js/games-content.js',
  '/js/games-engine.js',
  '/js/games-special.js',
  '/js/games-hub.js',
  '/js/reading.js',
  '/js/progress.js',
  '/js/profile.js',
  '/js/storage.js',
  '/js/ai.js',
  '/js/keyboard.js',
  '/assets/vendor/chart.umd.min.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Fora do domínio do app (Groq/OpenAI/Gemini, Google Fonts etc.) — não
  // interceptar. Deixa o navegador cuidar da requisição normalmente.
  if (url.origin !== self.location.origin) return;

  // Nunca cachear chamadas de API — são dinâmicas (IA, dados do usuário).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: 'offline' }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    )));
    return;
  }

  // App shell: cache-first, com atualização em segundo plano (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
