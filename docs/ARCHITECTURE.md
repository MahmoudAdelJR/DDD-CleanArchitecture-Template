# Architecture

This document defines the module structure and the dependency rules for this
template. Boundary enforcement is automated: ESLint import zones plus
`npm run check:architecture`, both wired into CI.

## Layer model

```text
src/app/
  app.config.ts / app.routes.ts   Composition root only
  backend-interceptors.ts         Build-swapped backend interceptor wiring
  core/                           Session, guards, interceptors, HTTP plumbing
  shell/                          Application layout and global pages
  features/<name>/                Vertical slices (routes, pages, store, data-access)
  shared/                         Business-agnostic, proven-reusable primitives
```

## Dependency rules

| From                              | May depend on                           | Must never depend on                              |
| --------------------------------- | --------------------------------------- | ------------------------------------------------- |
| `app.routes.ts` / `app.config.ts` | anything                                | —                                                 |
| `shell`                           | `core`, `shared`, features' route files | feature internals                                 |
| `features/<a>`                    | `core`, `shared`, its own folders       | `features/<b>` internals                          |
| `shared`                          | Angular/framework code only             | `core` code, features                             |
| `core`                            | `shared`, framework                     | features (except via ports it defines)            |
| `dev`                             | `core` config, `shared` models          | features (fixtures are plain JSON-shaped)         |
| any layer                         | —                                       | `features/*/data-access` from outside the feature |

Enforcement is layered: ESLint `import/no-restricted-paths` zones check
resolved import paths (relative imports cannot dodge them), and
`npm run check:architecture` fails CI when a feature folder lacks its zone
or its lazy route wiring. `app.config.ts` and `backend-interceptors.ts` are the
only modules allowed to wire `dev/` tooling.

`shared` currently depends on nothing app-specific: forms, dates, i18n
port + pipe, and pure UI primitives consume framework APIs and app-local
tokens (`TRANSLATION`) only. Services that render platform state
(notification toasts, loading bar) live under `core/ui`; authorization
directives live under `core/authorization` because they depend on
`PermissionService`.

## Creating slices (generators)

```bash
npm run gen:feature -- orders                # CRUD slice: list + detail + form, fake + HTTP adapter + prod providers
npm run gen:feature -- reports --read-only   # list + detail only (no create/edit routes or form)
npm run gen:feature -- invoices --workflow   # adds a domain/ folder with invariants + policy specs
npm run gen:page    -- orders approve        # new page inside an existing slice
```

The generator wires the lazy route into `app.routes.ts`, registers the
cross-feature ESLint zone, adds the slice's production `fileReplacements` entry
to `angular.json`, formats everything, and re-runs the architecture
check, typecheck, lint, and unit tests before exiting. It is transactional:
any failure — including formatting — automatically rolls the workspace back
to its exact prior state. Page-route insertion goes through the TypeScript
parser, so static pages always land before `:id` (one-line route arrays
included). Behavior is pinned by `npm run test:generator`, which exercises
the generator against throwaway fixture workspaces (never the repo).
Generated slices are conventions-compliant by construction (see ADR-0005);
manual slices must match the generated shape — CI checks the wiring either
way.

## Localization model

- `shared/i18n/translation.port.ts` — the `TRANSLATION` contract used by
  pipes/components (translate, locale signal, setLocale).
- `core/i18n/locale.service.ts` — the platform adapter: resolves the initial
  locale (persisted preference, validated against `AppConfig.supportedLocales`),
  persists changes, syncs `document.lang/dir` (RTL-aware), and owns the
  `en`/`fr` catalogs.
- `provideCoreI18n()` binds `TRANSLATION -> LocaleService` and maps `LOCALE_ID`
  to the bootstrapped locale. The `tr` pipe and `appDateFormat` pipe read the
  live locale signal, so runtime switching updates the UI.
- The `Accept-Language` header comes from the same service (trusted origins only).
- Validation, HTTP, and auth failure messages are catalog keys with
  `fallback` chains — no hardcoded strings in interceptors or stores.

## Date semantics

- Calendar dates (`yyyy-MM-dd`) are strings, parsed with
  `shared/dates/calendar-date.ts` into **local midnight** — never through UTC
  `toISOString()`, which can shift the day.
- Instants are `Date`/ISO timestamps and render in the viewer's time zone.
- `appDateFormat` auto-detects which kind it received and applies the chosen
  preset in the active locale.

## Accessibility baseline

- Skip link + `#main` landmark with `RouteFocusManager` focus moves on navigation.
- `app-field-error` renders localized messages; controls link via `aria-describedby`
  and report `aria-invalid`.
- Toast host uses `role=alert`/`status` with live regions; loading bar debounces
  and honors `prefers-reduced-motion` (globally reduced in `styles.scss`).
- `autofocus` is an opt-out boolean input (`[appAutofocus]="false"`).
- Theme: tokens swap for `prefers-color-scheme: dark`; force with
  `data-theme="light|dark"` on `<html>`.

## Vertical slice conventions

A slice (capability) owns everything specific to it:

```text
features/customers/
  customers.routes.ts            Lazy entry point + route-scoped providers
  customers.store.ts             Feature state (signals)
  data-access/
    customer.models.ts           Transport/view models owned by this slice
    customer.repository.ts       Port (interface + InjectionToken)
    in-memory-customer.repository.ts  Adapter; swap via route providers
  customer-list/                 Presentation
  customer-detail/               Presentation
```

Rules of thumb:

- Routes are lazy-loaded; feature state and adapters are provided at route level.
- Ports are owned by the feature that needs them — no global repository/use-case interfaces.
- Abstractions are only promoted to `shared` after at least two slices prove the need.
- DDD building blocks (aggregates, value objects, policies) are introduced only for
  slices with real invariants, not for CRUD screens.
- Server validation errors are mapped onto reactive forms with
  `applyServerValidationErrors(form, apiError)` from `core/http`, then surfaced
  through `app-field-error`.

## HTTP pipeline

`app.config.ts` registers functional interceptors in this order (outermost first):

```text
loading -> error -> language -> correlation -> auth -> backend
```

- `loading` counts pending requests (skippable per request via `SKIP_LOADING`).
- `error` normalizes every `HttpErrorResponse` into an `ApiError` (status, safe
  user message, code, field validation map, correlation id), logs it through
  the redacting `LOGGER`, reports 5xx to `TELEMETRY`, notifies the user unless
  `SUPPRESS_GLOBAL_ERROR` is set, and rethrows the `ApiError`.
- `language` adds `Accept-Language` only to trusted origins.
- `correlation` tags trusted requests with `x-correlation-id` (per app session).
- `auth` attaches the bearer token **only to same-origin or `trustedOrigins`
  requests**, and on 401 performs a single-flight refresh-and-retry via
  `AuthSessionService.refreshOnce()`; a failed refresh clears the session and
  redirects to `/login?returnUrl=…`.

Request-level opt-outs live in `core/http/http-context.ts`:
`SKIP_AUTH`, `SKIP_LOADING`, `SUPPRESS_GLOBAL_ERROR`.

## Session lifecycle

`AuthSessionService` (`core/services`) owns the session:

- private writable signals, public readonly + computed `isAuthenticated`
  (false once `expiresAt` has passed, measured through the injected `CLOCK`)
- persisted to the `STORAGE` port (`app.session.v1`) and restored by an
  `APP_INITIALIZER` — authentication survives page reload. `restoreSession()`
  is **idempotent and single-flight**, so a duplicated initializer can never
  trigger a second refresh.
- proactive expiry timer + reactive 401 refresh, both routed through the
  single-flight `SESSION_REFRESH_PORT` (implemented by the demo fake in
  development, the HTTP identity adapter in production). The timer delay is
  clamped to `MAX_TIMER_DELAY_MS` (a `setTimeout` overflow guard) and re-armed
  when it fires early, so long-lived sessions never refresh prematurely.
- cross-tab sync: `StoragePort.subscribe` surfaces another tab's writes, so a
  sign-out (or a refreshed token) in one tab is adopted by the others without
  echoing back.
- failed refresh or corrupt persisted state clears the session

Time and timers go through the `CLOCK` port (`core/time/clock.port.ts`,
`SystemClock` default). Specs inject `FakeClock` to advance time instead of
sleeping. See ADR-0007.

## Demo vs production composition

The template ships with in-memory adapters so it runs without a backend. Demo
and production wiring are selected at **build time** via `fileReplacements` in
`angular.json`'s `production` configuration (ADR-0006) — the demo modules are
not merely disabled, they are absent from the production module graph:

| Seam                | Demo default (file)                                                 | Production override (`.production.ts`)             |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| Auth ports          | `features/auth/data-access/auth-data-access.providers.ts`           | real `HttpAuthenticationAdapter` (sign-in/refresh) |
| Customer repository | `features/customers/data-access/customers-data-access.providers.ts` | `CustomerHttpRepository`                           |
| Backend mocks       | `src/app/backend-interceptors.ts`                                   | none                                               |
| Login demo hints    | `features/auth/sign-in/demo-accounts.ts`                            | empty list                                         |

Files without the `.production` suffix are the development/demo default, so
`npm start`, unit tests, and E2E stay backend-free. Two authorities keep this
honest:

- `HttpAuthenticationAdapter` implements `AuthenticationPort` + `SessionRefreshPort`
  over `HttpClient`, marking requests with `SKIP_AUTH` so a failing refresh can
  never recurse, and normalizing responses/errors into `SessionPayload` /
  `SignInFailure`.
- `npm run check:prod-bundle` scans `dist/` and fails if any demo credential or
  fixture string survives the production build.

To exercise the real HTTP path without a backend, set `AppConfig.mockApi: true`
in development: `src/app/dev/mock-api.interceptor.ts` (wired by
`backend-interceptors.ts`) answers trusted `/api` requests from
`mock-fixtures.ts` through the full interceptor pipeline.

Step-by-step: `docs/recipes/backend-cutover.md`.

Runtime configuration (`core/config/app-config.ts`, token `APP_CONFIG`) is
validated at startup: `apiBaseUrl`, `trustedOrigins` (bare origins only),
`supportedLocales`, `defaultLocale`, optional `mockApi`. Before Angular
bootstraps, `core/config/runtime-app-config.ts` fetches
`config/app-config.json`, rejects unknown or invalid values, and merges valid
partial values over `DEFAULT_APP_CONFIG`. This lets one compiled artifact move
through environments; see `docs/recipes/runtime-config.md`.

## Client-side authorization disclaimer

`authGuard`, `permissionGuard`, and `HasPermissionDirective` are UX controls.
They are not a security boundary. The server must authorize every protected
operation independently. See `docs/SECURITY.md`.

## Observability

- `shared/observability/logger.port.ts` — `LOGGER` token (`LoggerPort`).
- `core/logging/structured-console.logger.ts` — JSON-line adapter with secret
  key redaction (token/password/authorization/... → `[redacted]`), bounded
  recursion, and Error serialization without stacks.
- `core/logging/app-error.handler.ts` — single funnel for uncaught errors:
  structured log + `TELEMETRY` report.
- `core/telemetry/telemetry.port.ts` — replaceable sink (Noop by default;
  swap in Sentry/OTel/Azure Monitor at the composition root only).
- `core/telemetry/correlation.interceptor.ts` — per-session
  `x-correlation-id` on trusted API requests; captured back into `ApiError`.

## Quality gates (CI)

`.github/workflows/ci.yml` runs, in order: `npm ci` → `format:check` →
`lint` (includes the architecture boundary zones) → `check:architecture`
(slices wired: folder ↔ zone ↔ lazy route) → `typecheck` (app, specs,
e2e) → `test:ci` with an **80% line-coverage gate** → production `build`
(bundle budgets enforced by `angular.json`) → `check:prod-bundle` (no demo
credentials or fixtures in `dist/`) → dependency audit
(`audit:ci` for production + `node scripts/audit-allowlist.mjs` which fails
closed on un-allowlisted high/critical advisories; dev-only exceptions must
carry a reason and an expiry in `audit-allowlist.json`). The `e2e` job runs
the Playwright suite (`npm run e2e`, system Chrome) against a real dev server
and uploads the trace report.

Boundary enforcement is `import/no-restricted-paths` in `eslint.config.mjs`.
Prefer `npm run gen:feature` so zone entries and route wiring are produced
mechanically (ADR-0005); manual slices must add the matching entries — CI
checks both directions.

Docs map: decisions in `docs/adr/`, contribution + PR gates in
`docs/CONTRIBUTING.md`, security posture in `docs/SECURITY.md`, optional
platforms in `docs/recipes/` (backend cutover, feature flags, SSR, PWA).

## Production hosting

See `deploy/` — multi-stage Dockerfile (nginx), SPA fallback, hashed-asset
immutable caching, no-cache `index.html`, gzip, security headers incl. CSP
(with the `style-src` tradeoff documented), `/healthz`, and rollback notes.

## Demo accounts

These exist only in development/demo builds — the production build replaces
`demo-accounts.ts` with an empty list (ADR-0006).

| Email             | Password   | Permissions                     |
| ----------------- | ---------- | ------------------------------- |
| admin@demo.local  | Admin123!  | customers.read, customers.write |
| reader@demo.local | Reader123! | customers.read                  |
