# ADR-0005: Generator-produced slices with enforced boundaries

- Status: Accepted
- Date: 2026-10-16
- Deciders: template maintainers

## Context

Templates rot when the "blessed way" to add a feature is copy-paste: people
copy drift, boundaries leak, and CI becomes archaeology. The correct slice
must be easier to produce than an incorrect one.

## Decision

`npm run gen:feature -- <name> [--read-only] [--workflow]` and
`npm run gen:page -- <feature> <name>`
scaffold slices that are, by construction, conventions-compliant: folder
layout, port/token/in-memory adapter, route-scoped providers, list+detail
pages with a11y primitives, specs, the lazy route entry in `app.routes.ts`,
and the cross-feature zone in `eslint.config.mjs`. Feature mode defaults to a
full create/read/update slice (a form page, the write methods on the port, an
HTTP adapter, and the slice's production `fileReplacements` entry in
`angular.json`); `--read-only` produces a list+detail slice without writes.
Generated templates are localized through the `tr` pipe with inline fallbacks.
Insertion points are
marker comments; page routes are patched through the TypeScript parser (so
one-line `Routes` arrays and static-before-`:id` ordering are handled
correctly). `scripts/check-architecture.mjs` (CI step + post-generate
verification) fails if a feature folder lacks its zone or route wiring —
in either direction (stale zones, dead/duplicate imports, mismatched route
files). The generator is transactional: every touched file is snapshotted
before any write, gates (architecture, typecheck, lint, unit tests) run
after, and ANY failure — including formatting — restores the workspace to
its exact prior state. Tool invocations go through Node directly (no shell),
and the whole behavior is pinned by integration tests
(`npm run test:generator`) that run against temporary fixture workspaces on
Windows and Linux.

## Alternatives considered

- Custom Ng schematics — rejected as default: schematics workspace and CLI
  packaging overhead vs. a dependency-free Node script that is readable and
  forkable; teams can wrap it later.
- Copy the customers folder — rejected: silent drift, missing zones, no gates.

## Consequences

- Positive: new contributors produce review-ready slices in one command.
- Positive: boundary bookkeeping (zones/routes) is automated and checked.
- Negative: the generator's templates must evolve with the conventions —
  the verification run inside it and the integration-test suite are the
  safety net.
- Follow-up: consider packaging as schematics once template forks stabilize.
