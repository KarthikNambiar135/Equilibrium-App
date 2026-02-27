// Basic Service Worker for Equilibrium PWA
// Caches static assets for offline support

const CACHE_NAME = 'equilibrium-v2';
const urlsToCache = [
  '/',
  '/dashboard',
  '/groups',
  '/notifications',
  '/profile',
  '/icon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first for pages, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and external resources
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-first for API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503
        }))
    );
    return;
  }

  // Network-first for HTML pages (navigation requests) — always get fresh UI
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Cache-first for static assets only (_next/static, icons, images)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Return cached version and update in background
          fetch(event.request).then((newResponse) => {
            if (newResponse && newResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, newResponse.clone());
              });
            }
          }).catch(() => {});
          return response;
        }

        // Fetch from network and cache
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
  );
});

// Handle background sync for offline payments (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-payments') {
    event.waitUntil(
      // Future: sync pending payments when back online
      Promise.resolve()
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'Equilibrium', body: 'New notification', url: '/notifications' };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/notifications' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: 'equilibrium-' + Date.now(), // Unique tag so notifications stack
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/notifications';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if available
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
