/* Service worker do painel: permite instalar como aplicativo. Sempre busca na rede
   (o painel precisa dos dados mais recentes); sem internet, mostra a última versão da tela. */
var CACHE = 'painel-lorrany-v1';
var TELA = ['./', 'admin.css?v=2', 'admin.js?v=2', '../assets/img/logo.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(TELA); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).catch(function () { return caches.match(req, { ignoreSearch: true }); }));
});
