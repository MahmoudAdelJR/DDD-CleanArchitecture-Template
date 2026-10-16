# ADR-0002: Signals + route-scoped feature stores over a global store

- Status: Accepted
- Date: 2026-10-16
- Deciders: template maintainers

## Context

Enterprise Angular apps need predictable state, but adding a global store
(NgRx/Elf/Akita-style) from day one imposes action/reducer/effect ceremony
that simple CRUD slices do not pay for, and fights the zoneless signal-first
direction of Angular 20+.

## Decision

We use Angular signals. Local UI state lives in components; multi-component
feature state lives in `@Injectable()` stores provided at route level, so the
store's lifetime matches the feature visit. Server state is fetched through
feature-owned repository ports. Effects are plain promises/observables inside
stores.

A global store is adopted per-project only when specific criteria appear:
cross-feature cache sharing, time-travel debugging needs, or >N teams writing
to the same state.

## Alternatives considered

- NgRx from the start — rejected: ceremony exceeds benefit for slices;
  migration path stays open because stores are replaceable behind pages.
- Services with BehaviorSubjects — rejected: no template-time reactivity,
  manual unsubscribed discipline; signals compose with the zoneless renderer.

## Consequences

- Positive: small surface area, fast slices, aligned with Angular direction.
- Positive: stores are disposable — deleting a feature deletes its state.
- Negative: no enforced global state conventions; cross-feature state sharing
  must be explicitly designed when needed.
- Follow-up: document server-state caching (query dedup) when the first
  expensive endpoint appears.
