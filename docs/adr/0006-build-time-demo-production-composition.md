# ADR-0006: Build-time demo/production provider composition

- Status: Accepted
- Date: 2026-10-17
- Deciders: template maintainers

## Context

The template must run without a backend (demo mode) yet ship a production
build that contains no fake adapters, demo credentials, or mock data. Before
this decision the app always wired the in-memory auth/customer adapters and
the dev mock interceptor, and the login screen printed the demo credentials —
all of which would have been deployed as-is.

Runtime flags cannot solve this: an `if (config.mockApi) { … }` branch keeps
the demo module (and its credentials and fixtures) in the compiled output as
long as a reference remains, defeating tree-shaking.

## Decision

We will select demo vs production wiring at build time using Angular
`fileReplacements` (in the `production` build configuration), one per seam:

- auth: `features/auth/data-access/auth-data-access.providers.ts` (fake) →
  `.production.ts` (HTTP identity adapter).
- customers: `features/customers/data-access/customers-data-access.providers.ts`
  (in-memory) → `.production.ts` (HTTP repository).
- backend interceptors: `src/app/backend-interceptors.ts` (dev mock) →
  `.production.ts` (none).
- login demo hints: `features/auth/sign-in/demo-accounts.ts` (credentials) →
  `.production.ts` (empty list).

Files without the `.production` suffix are the development/demo default, so
`npm start`, unit tests, and E2E stay backend-free; only the `production`
build swaps them. `npm run check:prod-bundle` scans `dist/` and fails if any
demo credential or fixture string survives the build.

## Alternatives considered

- Runtime flag / `AppConfig.mockApi` branch — rejected: leaves demo code and
  secrets in the shipped bundle.
- Factory + `environment.ts` constants — rejected: same tree-shaking problem
  for credentials interpolated in templates.
- A second "prod" application target in angular.json — rejected: heavier and
  duplicates build configuration.

## Consequences

- Positive: the production module graph physically excludes demo code, and the
  bundle guard makes regressions loud.
- Positive: no page or store code changes; the swap stays at composition seams.
- Negative: each seam needs a parallel `*.production.ts` kept in sync.
- Follow-up: this narrows ADR-0003's "swap a provider line" guidance to local
  experimentation; production cutover now edits the `*.production.ts` siblings.
