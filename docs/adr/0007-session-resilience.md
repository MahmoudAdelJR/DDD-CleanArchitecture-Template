# ADR-0007: Session resilience — injected clock, idempotent restore, cross-tab sync

- Status: Accepted
- Date: 2026-10-17
- Deciders: template maintainers

## Context

`AuthSessionService` is the template's only long-lived, security-relevant
state. Three weaknesses became visible once real backends and multiple tabs
were considered:

- Expiry logic called `Date.now()` and `setTimeout` directly, so tests either
  slept in real time or asserted on non-deterministic behaviour.
- A proactive timer scheduled with `setTimeout` overflows its 32-bit delay
  beyond ~24.8 days and fires immediately, causing a premature refresh.
- `restoreSession()` was invoked by an app initializer; a duplicated initializer
  (or a future re-entry) could trigger a second refresh.
- Signing out in one tab left other tabs authenticated until the next 401.

## Decision

We will make session time and cross-context state explicit and testable:

1. **`CLOCK` port** (`core/time/clock.port.ts`) with a `SystemClock` default and
   a `FakeClock` test double. `AuthSessionService` reads `now()` and schedules
   timers only through `CLOCK`.
2. **Clamped, re-arming expiry timer.** A single delay is capped at
   `MAX_TIMER_DELAY_MS` (24h); when the timer fires early the handler recomputes
   the remaining time and re-arms, refreshing only at real expiry.
3. **Idempotent `restoreSession()`.** The first call performs the restore and is
   cached; later calls await the same promise and never re-refresh.
4. **Cross-tab sync.** `StoragePort` gains an optional
   `subscribe(handler): () => void` mirroring the browser `storage` event.
   `AuthSessionService` adopts a session another tab persisted and drops its own
   when another tab signs out, without re-persisting (no echo).

## Alternatives considered

- Polling or a BroadcastChannel for cross-tab sync — rejected: `storage` events
  are already built in, require no extra channels, and match the persistence
  layer we already depend on.
- `setInterval` re-checking expiry — rejected: wasteful; a clamped self-rearming
  timer is precise at the boundary and idle otherwise.
- Injecting `Date`/`performance` directly — rejected: an explicit `Clock` keeps
  the seam nameable and lets specs advance time deterministically.

## Consequences

- Positive: session expiry, refresh, and multi-tab behaviour are unit-testable
  without real timers or multiple browser contexts.
- Positive: long-lived sessions never refresh prematurely; duplicate
  initializers are harmless.
- Negative: `StoragePort` implementations may omit `subscribe`; callers must
  treat its absence as "no cross-tab sync" (in-memory adapters in tests opt in).
