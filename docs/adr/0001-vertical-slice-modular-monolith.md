# ADR-0001: Vertical slices in a modular monolith

- Status: Accepted
- Date: 2026-10-16
- Deciders: template maintainers

## Context

The template must support medium-to-enterprise teams where multiple features
evolve in parallel without a shared mush of cross-dependencies. Classic
layer-first Angular organization (`components/`, `services/`, `models/`)
makes every change touch every feature's files, creates merge conflicts, and
hides ownership.

## Decision

We organize application code into lazy-loaded feature slices under
`src/app/features/<name>/`, each owning its routes, pages, store, models and
data-access adapters. Cross-cutting platform code lives in `core/`, global
composition in `shell/`, and provably reusable business-agnostic code in
`shared/`. Dependency direction is enforced by ESLint
`import/no-restricted-paths` zones, not convention.

## Alternatives considered

- Layer-first folders — rejected: poor change locality, ownership invisible.
- Nx libraries per feature — rejected for the template baseline: heavy
  tooling and build graph for teams adopting a plain CLI repo; the folder
  discipline ports to Nx 1:1 when they graduate.
- Micro-frontends — rejected: premature for all but the largest orgs.

## Consequences

- Positive: a feature's blast radius is one folder; deletion is safe;
  ownership maps to code owners.
- Positive: boundaries are machine-checked in CI; new slices come pre-wired.
- Negative: per-feature duplication is intentional until two consumers prove
  extraction; teams must resist premature `shared/` hoarding.
- Follow-up: CODEOWNERS per feature when repo teams grow.
