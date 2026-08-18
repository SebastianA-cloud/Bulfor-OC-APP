// Service worker mínimo — solo existe para que el navegador permita
// "Instalar app". No cachea nada todavía (la app siempre pide todo fresco
// a Supabase), así que no hay riesgo de que alguien vea datos viejos.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // pass-through: no intercepta nada
