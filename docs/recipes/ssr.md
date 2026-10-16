# Recipe: Server-side rendering (SSR) + hydration

Consider SSR when you need SEO, first-paint speed, or pre-rendered share
cards — not as a default. The template stays browser-first; enabling SSR is
deliberately a recipe.

## 1. Add the platform

```bash
ng add @angular/ssr
ng serve --ssr
```

Review the generated `server.ts` / app config; keep `provideZonelessChangeDetection`,
the interceptor pipeline, and `provideAppInitializer` work as-is.

## 2. De-globalize browser globals (the audit trail)

The template intentionally touches browser globals in exactly these places;
make each platform-safe before shipping SSR:

| Place                                         | Today                                 | SSR change                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/config/app-config.ts` `isTrustedApiUrl` | `document.baseURI`, `window.location` | inject `DOCUMENT`; resolve relative URLs against a server-configured origin (or skip the check server-side by allowing only configured `apiBaseUrl` absolute origins) |
| `core/i18n/locale.service.ts`                 | `document.documentElement` lang/dir   | inject `DOCUMENT` (Angular provides it on server)                                                                                                                     |
| `core/a11y/route-focus.manager.ts`            | `document.getElementById`             | guard with `isPlatformBrowser(inject(PLATFORM_ID))`                                                                                                                   |
| `core/storage/browser-storage.adapter.ts`     | localStorage                          | already falls back to in-memory ✓                                                                                                                                     |
| `dev/mock-api.interceptor.ts`                 | `document.baseURI`                    | dev-only; keep `mockApi: false` on server                                                                                                                             |
| `shared/directives/autofocus.directive.ts`    | `elementRef.focus()` in microtask     | focus() no-ops server-side ✓                                                                                                                                          |

Pattern:

```ts
private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
private readonly document = inject(DOCUMENT);
```

## 3. Session restore on the server

`restoreSession()` reads storage — server renders **unauthenticated** (the
guard + 401 pipeline handle it after hydration). Do not put tokens into
server context in this recipe; a real BFF/cookie design changes this and
warrants its own ADR.

## 4. Verify

```bash
npm run build   # prerender + server targets appear in angular.json
node dist/<project>/server/server.mjs
```

Watch hydration mismatch warnings; `tr` pipe is `pure: false` — fine with
hydration since locale is deterministic at bootstrap (persisted preference
is browser-side only; server renders defaultLocale).

## Notes

- `@angular/ssr` adds a Node server or platform adapter — deployment differs
  from `deploy/nginx.conf` static recipe.
- Bundle budgets: lazy chunks already keep initial small; measure before
  adding critical-CSS tweaks.
