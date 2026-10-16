# Changelog

All notable changes to this template are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MahmoudAdelJR/DDD-CleanArchitecture-Template/releases/tag/v1.0.0
