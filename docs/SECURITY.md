# Security Policy

## The one rule that matters

This is a browser application. Everything here — routes, guards,
`HasPermissionDirective`, hidden buttons, in-memory permission lists — is a
UX convenience. It is **not** a security boundary. The backend must
authenticate and authorize every request independently, and the frontend
must never be the only thing deciding anything sensitive.

## Current hardening in the template

- Bearer tokens are attached only to same-origin or `AppConfig.trustedOrigins`
  URLs (`isTrustedApiUrl`); third-party requests are credential-free and
  header-free (no CORS preflight surprises).
- Session signals are private with readonly/computed public views; persisted
  sessions are schema-validated and cleared on corruption or failed refresh.
- Single-flight refresh with forced logout on failure; 401s reaching the
  error interceptor mean "re-auth required" by pipeline design (ADR-0004).
- Structured logging redacts secret-looking keys (`token`, `authorization`,
  `password`, `cookie`, …) before anything reaches console/telemetry sinks.
- API errors are normalized to safe user-facing messages; raw 5xx bodies and
  stack traces never surface to users; correlation IDs aid forensics.
- Production build path: `deploy/` ships CSP (incl. `frame-ancestors 'none'`),
  nosniff, referrer/permissions policy, no-cache HTML, immutable hashed
  assets; enable HSTS once TLS exists. `connect-src` is generated from
  `APP_CSP_CONNECT_SRC` at container start and must list every API origin —
  keep it in sync with `trustedOrigins`.
- Runtime config is schema-validated before bootstrap, fetched without caching,
  and fails closed except for an intentional `404` defaults fallback. It is
  public browser data: never place credentials or secrets in it, and treat
  `trustedOrigins` changes as security-sensitive deployment policy.
- CI dependency gates: production `npm audit` must report zero high; dev
  exceptions require reason + expiry in `audit-allowlist.json`.
- CSP note: component styles require `style-src 'unsafe-inline'` unless the
  build extracts them — see `deploy/security-headers.conf.template`.

## Things a consuming team must decide (not template defaults)

1. **Token storage threat model.** Memory + sessionStorage-style persistence
   is used here to make demos work; for real apps weigh XSS exposure,
   HttpOnly cookie/BFF patterns, and refresh rotation. Document your choice
   in an ADR.
2. **CSP tuning** per integration (map embeds, third-party APIs, telemetry
   endpoints).
3. **Data classification** — never render PII/secrets into console or toast
   bodies.
4. **Dependency provenance** — pin the registry (internal mirror/proxy) and
   enable SBOM generation in your release pipeline.

## Reporting vulnerabilities

Open a private security advisory (GitHub → Security → Report a vulnerability),
or use the contact your organization defines for internal templates. Include
the exact commit/tag, a reproduction path, and an impact assessment. Avoid
public issues for exploitable findings.

## Release posture

Deploy tagged, immutable artifacts (`deploy/`), keep `index.html`
no-cache so fixes actually reach users, and monitor reported error telemetry
correlation IDs against releases.
