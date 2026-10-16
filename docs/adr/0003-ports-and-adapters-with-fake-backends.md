# ADR-0003: Ports & adapters with fake backends as the API seam

- Status: Accepted
- Date: 2026-10-16
- Deciders: template maintainers

## Context

A frontend template must be runnable and testable without a backend, while
still teaching the architecture used against real services: transport DTOs,
swappable data access, and contracts that catch drift.

## Decision

Every slice defines its repository port (interface + `InjectionToken`) and
ships an in-memory fake adapter as the default binding, provided at route
level. The same slice may carry a real HTTP adapter extending
`BaseHttpService` (see `CustomerHttpRepository`). Ports are owned by their
feature; only session/refresh and translation contracts live in `core`
because the platform itself consumes them.

Transport shapes are pinned by a contract spec per slice
(`*.contract.spec.ts`), which validates pagination metadata, key sets, and
clamping. The contract spec pointed at a real backend or generated OpenAPI
client after cutover is the drift alarm. Dev-time HTTP behavior is available
via `src/app/dev/mock-api.interceptor.ts` behind `AppConfig.mockApi`, wired
only in the composition root.

## Alternatives considered

- Mock everything with MSW — viable, rejected as default: extra dependency
  and worker lifecycle for a template; documented as a swap candidate.
- Http-first samples with json-server — rejected: needs a running process.
- Global shared repositories/`BaseCrudService` inheritance — rejected:
  erases aggregate-specific behavior (see Phase 1 audit).

## Consequences

- Positive: `npm start` demos the full UX; tests run without network.
- Positive: backend cutover is a provider swap in one route file.
- Negative: fake data can drift from the real API until contract specs are
  pointed at it — CI must run them against staging (follow-up).
- Follow-up: OpenAPI client generation replaces hand-written HTTP adapters
  once the backend publishes a spec.
