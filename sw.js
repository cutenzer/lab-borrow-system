// ── 實驗室借用系統 Service Worker ──────────────────────────
// 每次「功能更新、要讓使用者抓到新版本」時，把下面這個版本號 +1
// 例如 v1 → v2，Service Worker 會自動清掉舊快取、抓新檔案
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'lab-borrow-' + CACHE_VERSION;

// 開啟 App 時，這些檔案會優先從本機快取讀取，達到「不白屏、開啟快」的效果
// 注意：借用記錄、庫存等「即時資料」一律直接連線 Supabase，不會被快取
const PRECACHE_URLS = [
  './index.html',
  './admin.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安裝階段：把上面列的檔案存進快取
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 啟用階段：清掉舊版本的快取（版本號變更後，上一版的快取會被刪除）
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 攔截網路請求
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Supabase 的 API 與圖片請求一律直接連網路，絕不快取
  // （借用記錄、庫存數量、場地預約都需要即時資料，快取了反而會看到過期資訊）
  if (url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 其餘的（HTML、manifest、圖示）採用「network first，失敗才退回快取」
  // 這樣只要有網路，永遠看最新版本；沒網路時才用快取版本，避免白屏
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
