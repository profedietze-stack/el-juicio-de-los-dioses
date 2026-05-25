// El Juicio de los Dioses — Service Worker
// CACHE_VERSION se deriva del parámetro ?v= con que se registra el SW.
// Cuando index.html cambia, BUILD_TS cambia → nuevo nombre de caché →
// el SW activo en versiones anteriores se reemplaza y la caché vieja se borra.
const _v = new URL(self.location.href).searchParams.get('v') || 'juicio-v1';
const CACHE_VERSION = 'juicio-' + _v;

// Instalar: guardar assets en caché
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Google Fonts puede fallar en instalación si no hay red — no es crítico
      return cache.addAll(['./','./index.html']).then(() =>
        cache.add('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Lora:ital,wght@0,400;0,500;1,400&display=swap')
          .catch(() => {}) // offline install: fonts fallan silenciosamente
      );
    })
  );
  self.skipWaiting();
});

// Activar: eliminar cachés de versiones anteriores
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache-first para assets propios, Network-first para Google Fonts
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo interceptar GET
  if (e.request.method !== 'GET') return;

  // Google Fonts: network-first con fallback a caché
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Todo lo demás: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
