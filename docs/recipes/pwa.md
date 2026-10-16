# Recipe: PWA (installability + offline)

Only adopt when offline/installability is a product requirement — the
service worker adds release-lifecycle complexity (stale-while-revalidate
vs freshness tradeoffs, cached auth flows).

## 1. Add the platform

```bash
ng add @angular/pwa
```

Generates `ngsw-config.json`, manifest, icons. Adjust `applicationPrerender`
as needed with your build config.

## 2. Grouping strategy that fits this app

```jsonc
{
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app",
      "installMode": "prefetch",
      "resources": { "files": ["/index.html", "/styles.*.css", "/*.css", "/*.js"] },
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": { "files": ["/favicon.ico", "/media/**/*", "/*.(svg|png|jpg|webp|woff2)"] },
    },
  ],
  "dataGroups": [
    {
      // Server data is NOT cached here by default. Caching API responses
      // means the SW serves them after sign-out too. Only add a dataGroup
      // for genuinely public read endpoints, with short maxAgeSeconds.
      "name": "public-catalog",
      "urls": ["/api/public/**"],
      "cacheConfig": { "strategy": "freshness", "maxAge": "5m" },
    },
  ],
}
```

Never data-group authenticated `/api/customers`-style payloads without an
explicit threat + logout-cache-clearing design; the app caches session in
`localStorage` (key `app.session.v1`) — decide consciously whether SW-cached
HTML could serve a logged-out shell against a stale session (it can; the
guards handle it).

## 3. Update UX

`SwUpdate` → surface a reload prompt via `NotificationService` (a `success`
toast with an action is enough for the template pattern).

## 4. Verify

- `npm run build` then serve `dist` **over https/localhost** (SW needs trust)
- DevTools → Application → Service Worker: registered; offline → shell +
  locale + fixtures behave as chosen; hard reload picks up new version.
- Lighthouse PWA audit as a smoke test (budgets stay in `angular.json`).
