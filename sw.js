const CACHE_NAME = 'life-tracker-v2';
const urlsToCache = ['./index.html', './style.css', './app.js', './firebase-config.js'];

// 安裝時立刻跳過等待，強制接管
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
    self.skipWaiting(); 
});

// 啟動時自動清除舊版本的快取垃圾
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
    self.clients.claim(); 
});

// 💡 改為「網路優先 (Network First)」策略
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => {
            // 如果斷網，才去抓快取裡的檔案
            return caches.match(event.request);
        })
    );
});
