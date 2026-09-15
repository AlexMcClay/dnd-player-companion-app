/// <reference lib="webworker" />

/**
 * What makes the app work with no signal.
 *
 * The shape of it: the app itself is precached, so it launches; requests for
 * data go to the network first and fall back to what was last seen; fonts and
 * pictures are cached because an offline app in the wrong typeface with grey
 * boxes where the portraits were does not feel like the same app.
 *
 * The one genuinely subtle rule is in `identityCacheKey` below.
 */
import { cacheNames, clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import type { WorkboxPlugin } from 'workbox-core/types'

declare const self: ServiceWorkerGlobalScope

/** Where the identity-scoped API responses live, so the page can clear them. */
const API_CACHE = 'codex-api'

precacheAndRoute(self.__WB_MANIFEST)

/*
  Any navigation is answered with the app shell — that is what makes a deep
  link like /e/<id> work offline, and it mirrors Caddy's `try_files`.

  The denylist is load-bearing: without it an offline request to /api/entities
  would be answered with a 200 and a page of HTML, and the client would try to
  read it as JSON.
*/
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
)

/**
 * Two people using one phone must not see each other's data.
 *
 * Knowledge gating is decided by the server from the `x-dm-key` and
 * `x-player-id` headers, which means the *same URL* returns different rows to
 * different people: the DM sees sealed entries, and a player's vault notes are
 * their own. A cache keyed on the URL alone would hand the DM's copy of
 * /api/entities to whoever picked the phone up next.
 *
 * A service worker cannot read localStorage, where the identity actually lives
 * — but it does not need to. The app already puts both values on every request,
 * so the key is built from the headers in hand. A different reader simply
 * misses the cache and gets nothing rather than something that is not theirs.
 *
 * The DM key is reduced to a flag rather than used verbatim: the passphrase
 * should not be sitting in a cache key. Two different DM passphrases collide,
 * which is harmless — a wrong one cannot get into DM mode in the first place,
 * because unlocking is a network call that fails while offline.
 */
function identityOf(request: Request): string {
  const player = request.headers.get('x-player-id') ?? 'anon'
  const dm = request.headers.get('x-dm-key') ? '+dm' : ''
  return `${player}${dm}`
}

const identityCacheKey: WorkboxPlugin = {
  // Workbox calls this for reads and writes alike, so both sides agree on the
  // key. Returning a string is allowed; it is only ever used as a cache key.
  cacheKeyWillBeUsed: async ({ request }) =>
    `${request.url}${request.url.includes('?') ? '&' : '?'}__as=${encodeURIComponent(identityOf(request))}`,
}

/*
  Data. Network first, so a connected app is never showing yesterday's party
  stash; the cache exists for the moment the signal goes.

  Only GET — a write must never be answered from a cache, and Workbox will not
  match anything else here anyway.
*/
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: API_CACHE,
    // Long enough to cross a dead spot, short enough that a stalled request
    // does not make the app feel broken while the network is merely slow.
    networkTimeoutSeconds: 6,
    plugins: [
      identityCacheKey,
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

/*
  Portraits and item art. These are absolute URLs to S3 or MinIO, so they are
  cross-origin and the <img> tags carry no `crossorigin` attribute — the
  responses are opaque. That is fine for pictures: they cannot be inspected,
  only replayed, which is all a cache needs to do. Browsers pad opaque entries
  heavily against the storage quota, so the cap is deliberately modest.
*/
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'codex-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 120,
        maxAgeSeconds: 60 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
)

// The stylesheet changes when Google revises the fonts; the font files never
// change, because their URLs contain a hash.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 })],
  }),
)

/*
  Updating. The new worker waits rather than taking over, so a tab open in front
  of the table keeps the build it started with until someone accepts the
  reload — `registerType: 'prompt'` in vite.config.ts is the other half of this.
*/
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
  // Locking DM mode drops the entries cached while unlocked, so "lock up before
  // handing the phone over" is true of what is stored and not only of what is
  // on screen.
  if ((event.data as { type?: string } | null)?.type === 'FORGET_DM') {
    event.waitUntil(forgetDmResponses())
  }
})

async function forgetDmResponses(): Promise<void> {
  const cache = await caches.open(API_CACHE)
  const keys = await cache.keys()
  await Promise.all(keys.filter((key) => key.url.includes('%2Bdm')).map((key) => cache.delete(key)))
}

clientsClaim()

// Caches from an older version of this worker, left behind by a rename.
self.addEventListener('activate', (event) => {
  const keep = new Set([
    API_CACHE,
    'codex-images',
    'google-fonts-css',
    'google-fonts-files',
    cacheNames.precache,
    cacheNames.runtime,
    cacheNames.googleAnalytics,
  ])
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => !keep.has(name)).map((n) => caches.delete(n)))),
  )
})
