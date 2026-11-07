/* Clashcade — modo offline (01/11). Guarda o que já foi aberto e serve do cache quando não há internet.
 * Estratégia: devolve do cache na hora (rápido) e atualiza o cache em segundo plano quando há rede.
 * Arquivos com hash no nome (assets/) nunca mudam; o index.html sempre tenta a rede primeiro. */
const PREFIX = 'clashcade-';
const CACHE = PREFIX + 'v13';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || req.headers.has('range')) return;
  if (req.mode === 'navigate') {
    // página: rede primeiro (pega versão nova), cache se estiver sem internet
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('./index.html', c)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok && r.status === 200) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }),
  );
});
