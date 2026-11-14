const CACHE = 'notas-347d5431cf';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icone.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) {
    // página: tenta a internet primeiro (versão nova); sem conexão, usa a guardada
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('./'))));
    return;
  }
  // demais arquivos (leitor de PDF, ícone): usa o guardado e atualiza em segundo plano
  e.respondWith(caches.match(e.request).then((r) => { const rede = fetch(e.request).then((n) => { const c = n.clone(); caches.open(CACHE).then((cc) => cc.put(e.request, c)); return n; }); return r || rede; }));
});
