# ADR-0004: Interceptor ordering and single-flight 401 refresh

- Status: Accepted
- Date: 2026-10-16
- Deciders: template maintainers

## Context

HTTP cross-cutting concerns interact: refresh-retry must happen before the
user is told about a failure; loading must span retries; credentials must
never leak to third parties; custom headers trigger CORS preflights and
should be scoped.

## Decision

Fixed outermost-first pipeline registered in `app.config.ts`:

```
loading -> error -> language -> correlation -> auth -> mock -> backend
```

- `auth` is innermost before the mock: it attaches bearer tokens only to
  same-origin/`trustedOrigins` URLs, and on 401 performs one shared
  (`AuthSessionService.refreshOnce()`) refresh and retries the original
  request once. A failed refresh clears the session and routes to
  `/login?returnUrl=…`.
- `error` sits outside `auth`, so it normalizes/logs/notifies only failures
  that survived retry (a 401 reaching it means "re-auth required").
- `language`/`correlation` only mutate trusted-origin requests, keeping
  third-party calls simple-CORS.
- `loading` outermost: spinner spans the full retry chain; per-request
  opt-outs via `HttpContextToken`s (`SKIP_LOADING`, `SKIP_AUTH`,
  `SUPPRESS_GLOBAL_ERROR`).
- `mock` is last and only active when `AppConfig.mockApi` is true, so tests
  and production pass-through semantics are identical.

## Alternatives considered

- Refresh in the error interceptor — rejected: error UI fires for transient
  401s that retry would have fixed.
- Pre-emptive expiry polling per request — rejected: extra complexity;
  401-driven + session expiry timer covers both.

## Consequences

- Positive: concurrent 401s trigger exactly one refresh (unit-tested).
- Positive: order is documented in code and CI-locked by interceptor specs.
- Negative: interceptor order changes need spec updates; treat as a decision,
  not a refactor detail.
