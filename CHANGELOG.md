# Changelog

All notable changes to this template are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2026-10-17

### Added

- Build-time demo/production composition (ADR-0006): the production build
  swaps demo adapters, the dev mock backend, and the login demo hints for
  production implementations via `fileReplacements` in `angular.json`, so demo
  code is absent from — not merely disabled in — the production bundle.
- `HttpAuthenticationAdapter`: real identity adapter implementing
  `AuthenticationPort` + `SessionRefreshPort` over `POST /auth/sign-in` and
  `POST /auth/refresh`, with `SKIP_AUTH` (prevents recursive refresh) and
  defensive response normalization into `SessionPayload` / `SignInFailure`.
- `npm run check:prod-bundle`: scans `dist/` and fails if demo credentials or
  fixtures survive the production build (wired into CI).
- Unit coverage for the HTTP auth adapter (sign-in, refresh, refused and
  malformed responses, ISO-8601 expiry parsing).

### Changed

- `app.config.ts` composes backend interceptors from
  `src/app/backend-interceptors.ts` instead of importing the dev mock directly.

### Fixed

- Demo credentials are no longer rendered by the login page in production
  builds.

## [1.3.1] - 2026-10-17

### Fixed

- HTTP repositories now consume the normalized `ApiError` thrown by the error
  interceptor instead of a raw `HttpErrorResponse`. Real-backend
  `CustomerNotFoundError` mapping previously only worked when the interceptor
  chain was absent, so 404s fell through to a generic error in production.
- Backend `detail`/`title` values from 5xx responses are no longer surfaced to
  users; only the localized catalog message is used. `code`, correlation id, and
  4xx validation messages still flow through unchanged.
- Production CSP `connect-src` is generated from `APP_CSP_CONNECT_SRC` at
  container start, so an API origin allowed by runtime configuration is no
  longer blocked in production.

### Added

- `AppConfig.apiBaseUrl` validation: it must be a same-origin path or an
  absolute `http(s)` URL; protocol-relative and credential-bearing URLs are
  rejected, an absolute origin must be listed in `trustedOrigins`, and trailing
  slashes are normalized.
- Test coverage for the `ApiError` contract (repository behind the real
  interceptor pipeline), safe 5xx messages, and API base URL validation.

## [1.3.0] - 2026-10-17

### Added

- Deployment-time runtime configuration from `config/app-config.json`, loaded
  and validated before Angular bootstrap. Partial config overlays safe defaults;
  malformed JSON, unknown keys, invalid values, and non-404 HTTP errors stop
  startup with an accessible error message.
- nginx container environment variables generate runtime config on each start,
  allowing one immutable image to be promoted across environments.
- Runtime configuration recipe and security guidance.

### Changed

- `init:project --api-base-url` and `--default-locale` now write the runtime
  config asset instead of changing compiled TypeScript defaults.

## [1.2.0] - 2026-10-16

### Added

- **`npm run init:project`** — one-time, transactional project initializer for
  template consumers. Renames the npm package, Angular project (and the CI +
  Docker artifact paths derived from it), browser title, both locale catalogs'
  `app.title`, namespaced session/language storage keys, and the README/Docker
  docs; optionally sets `apiBaseUrl`, `default-locale` (syncs `index.html`
  lang), and the consumer app version (default `0.1.0`). Supports `--dry-run`
  (exact change manifest), interactive prompting when `--name` is omitted, and
  refuses re-runs via a `project.init.json` sentinel unless `--force`.
  Verification (format, architecture, typechecks, lint, unit tests, build) runs
  inside the transaction — any failure restores every file exactly and removes
  the sentinel. Proven end-to-end on a disposable clean checkout:
  `Use this template → npm ci → init:project` produced a fully renamed,
  all-gates-green project.
- `npm run test:init` — 6 initializer integration suites on temporary fixture
  workspaces (rename correctness, options, dry-run, re-run refusal, rollback,
  input validation); added to the Windows/Linux CI matrix job.
- Shared `scripts/workspace.mjs`: the transactional editor, no-shell tool
  runner, and error type now power the generator and the initializer alike.

### Changed

- README adoption flow now leads with `init:project`; the manual "rename
  everything" checklist became opt-in branding guidance (favicon, tokens,
  git remote, security contact).

## [1.1.0] - 2026-10-16

### Added

- Generator integration tests (`npm run test:generator`): 25 scenarios on
  throwaway fixture workspaces under the OS temp dir — success paths, strict
  argument validation, marker errors, route-ordering regressions, rollback
  on every gate failure, and no-shell argument passing.
- CI matrix job running the generator tests on both Ubuntu and Windows.
- `check:architecture` now also detects stale zones, duplicate zones,
  duplicate lazy imports, mismatched `<feature>.routes` filenames, and
  missing route files.

### Changed

- **The generator is now transactional.** Every touched file is snapshotted
  before any write; any failure (formatter included) restores the workspace
  to its exact prior state instead of printing manual revert steps.
- Prettier failures abort generation (previously logged and ignored).
- Argument validation is strict and pre-flight: raw kebab-case enforced,
  unknown flags and extra arguments rejected, duplicate route paths
  detected — nothing is written when validation fails.
- Page routes are inserted via the TypeScript parser: static pages always
  land before `:id`/wildcard routes.
- Tool invocations run through Node directly (`shell: false`, checked-in CLI
  entry points) — fixes the `DEP0190` warning and removes shell
  argument-interpretation risk on Windows.
- Generator verification now includes the architecture integrity check.
- `scripts/**/*.mjs` are covered by format/lint gates.

### Fixed

- `gen:page` corrupted one-line `Routes` arrays (e.g. `identity.routes.ts`)
  by inserting outside the brackets.
- A missing `--write` flag made the generator's formatting step a silent
  no-op (caught by the real-workspace proof run).

## [1.0.1] - 2026-10-16

### Added

- GitHub community files: pull request template, issue forms (bug report,
  template improvement), and a support policy.
- This changelog.

### Changed

- README rewritten around template adoption: prerequisites, a green-baseline
  verification sequence, a customization checklist, clickable documentation
  links, and "when this fits / doesn't fit" guidance.
- CI and docs use the single documented `npm run audit:gate` interface.
- CI unit-test step sets `pipefail` explicitly so a failing test command can
  never be masked by the coverage-parsing pipeline.
- `docs/ARCHITECTURE.md` intro describes enforcement as live (it was stale).

### Fixed

- Broken `docs/CONTRIBUTING.md` link to the ADR index.
- Four unit tests reported "spec has no expectations" warnings; they now
  assert the responses they flush.

## [1.0.0] - 2026-10-16

### Added

- Initial template: Angular 20 vertical-slice architecture (lazy slices,
  ports & adapters, route-scoped stores/providers, signals), enforced by
  ESLint import zones and `npm run check:architecture`.
- Self-verifying generators: `npm run gen:feature [--workflow]` and
  `npm run gen:page` with automatic route/zone wiring and full gate reruns.
- Secure session lifecycle (persistence, proactive expiry, single-flight
  refresh, trusted-origin token attach), normalized HTTP errors, correlation
  IDs, structured logging with secret redaction.
- i18n (en/fr, RTL-aware), date semantics, a11y primitives, shared forms/UI.
- Dev mock API (`AppConfig.mockApi`) + real `CustomerHttpRepository` proving
  the one-line backend cutover.
- Quality pipeline: format/lint/typecheck/test (80% line gate)/build
  budgets/audits/Playwright E2E in CI; nginx Docker deployment reference;
  ADRs, contributing and security docs, recipes (backend cutover, feature
  flags, SSR, PWA). MIT-licensed.

[unreleased]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/releases/tag/v1.0.0
