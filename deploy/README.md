# Production Hosting Reference

A batteries-included static hosting setup for this Angular app: multi-stage
Docker build → nginx with SPA routing, compression, cache policy, security
headers, and a health endpoint.

## Build & run

```bash
docker build -f deploy/Dockerfile -t ddd-template-web:local .
docker run --rm -p 8080:8080 ddd-template-web:local
# → http://localhost:8080
```

## What is configured

| Concern              | Setting                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| SPA fallback         | `try_files $uri $uri/ /index.html` — deep links work                       |
| Compression          | gzip for js/css/json/svg (add brotli with a brotli-enabled image)          |
| Cache: hashed assets | `max-age=31536000, immutable` (`outputHashing: all` in prod builds)        |
| Cache: index.html    | `no-cache, no-store` — deploys appear on next request                      |
| Security headers     | see `security-headers.conf` (CSP, nosniff, referrer, permissions, framing) |
| Health check         | `GET /healthz` used by Docker HEALTHCHECK and orchestrators                |
| Non-root port        | listens on 8080 for container platforms that drop root                     |

## Runtime configuration

`AppConfig` (`src/app/core/config/app-config.ts`) is compile-time today. For
per-environment promotion without rebuilds, add a bootstrap step that fetches
`/config.json` in `provideAppInitializer` and supplies it via
`provideAppConfig(...)`, keeping `validateAppConfig` before the app starts.

## TLS and HSTS

Terminate TLS at your load balancer/CDN, then enable the commented
`Strict-Transport-Security` line (or the equivalent platform policy).

## Rollback strategy

Deploy immutable, tagged images (`git rev-parse --short HEAD`). Rollback is a
previous tag redeploy; index.html no-cache guarantees users pick up the swap.
