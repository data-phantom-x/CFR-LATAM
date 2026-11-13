// ─── SERVICE WORKER — CFR Cabin Furnishings Report ───────────────────────────
const VERSION = 'cfr-v2';
const CACHE_APP = `${VERSION}-app`;
const CACHE_VENDOR = `${VERSION}-vendor`;

const PRECACHE = [
  './',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './icons/cfr-logo.svg',
  './icons/share-ios.png',
];

const NUNCA_CACHEAR = [
  'firebaseio.com',
  'firebasedatabase.app',
  'firebaseapp.com',
  'web.app',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'googleapis.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => Promise.all(
        PRECACHE.map((url) => cache.add(url).catch((err) => {
          console.warn('[sw] no se pudo cachear', url, err);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_APP && k !== CACHE_VENDOR).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.tipo === 'actualizar') self.skipWaiting();
});

function esDeFirebase(url) {
  return NUNCA_CACHEAR.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));
}

async function redPrimero(request, revalidar) {
  const cache = await caches.open(CACHE_APP);
  try {
    const respuesta = await fetch(request, revalidar ? { cache: 'no-cache' } : undefined);
    if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch (err) {
    const guardada = await cache.match(request)
      || (request.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (guardada) return guardada;
    throw err;
  }
}

async function cachePrimeroRevalidando(request, nombreCache) {
  const cache = await caches.open(nombreCache);
  const guardada = await cache.match(request);
  const desdeRed = fetch(request, { cache: 'no-cache' }).then((respuesta) => {
    if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  }).catch(() => null);
  return guardada || desdeRed;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (esDeFirebase(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(redPrimero(request, true));
    return;
  }

  const esPropio = url.origin === self.location.origin
    && (url.pathname.endsWith('/manifest.json') || url.pathname.includes('/icons/'));
  if (esPropio) {
    event.respondWith(redPrimero(request, true));
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(cachePrimeroRevalidando(request, CACHE_VENDOR));
  }
});