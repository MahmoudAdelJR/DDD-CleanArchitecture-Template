# ADR-0005: Generator-produced slices with enforced boundaries

- Status: Accepted
- Date: 2026-10-16
- Deciders: template maintainers

## Context

Templates rot when the "blessed way" to add a feature is copy-paste: people
copy drift, boundaries leak, and CI becomes archaeology. The correct slice
must be easier to produce than an incorrect one.

## Decision

`npm run gen:feature -- <name> [--workflow]` and `npm run gen:page -- <feature> <name>`
scaffold slices that are, by construction, conventions-compliant: folder
layout, port/token/in-memory adapter, route-scoped providers, list+detail
pages with a11y primitives, specs, the lazy route entry in `app.routes.ts`,
and the cross-feature zone in `eslint.config.mjs`. Insertion points are
marker comments; `scripts/check-architecture.mjs` (CI step + post-generate
verification) fails if a feature folder lacks its zone or route wiring.
The generator runs typecheck, lint, and the unit suite before declaring
success, and prints revert steps otherwise.

## Alternatives considered

- Custom Ng schematics — rejected as default: schematics workspace and CLI
  packaging overhead vs. a dependency-free Node script that is readable and
  forkable; teams can wrap it later.
- Copy the customers folder — rejected: silent drift, missing zones, no gates.

## Consequences

- Positive: new contributors produce review-ready slices in one command.
- Positive: boundary bookkeeping (zones/routes) is automated and checked.
- Negative: the generator's templates must evolve with the conventions —
  the verification run inside it is the safety net.
- Follow-up: consider packaging as schematics once template forks stabilize.
