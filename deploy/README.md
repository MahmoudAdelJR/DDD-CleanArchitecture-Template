# Production Hosting Reference

A batteries-included static hosting setup for this Angular app: multi-stage
Docker build → nginx with SPA routing, compression, cache policy, security
headers, and a health endpoint.

## Build & run

```bash
docker build -f deploy/Dockerfile -t ddd-template-web:local .
docker run --rm -p 8080:8080 \
  -e APP_API_BASE_URL=https://api.example.com/v1 \
  -e 'APP_TRUSTED_ORIGINS=["https://api.example.com"]' \
  ddd-template-web:local
# → http://localhost:8080
```

## What is configured

| Concern              | Setting                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| SPA fallback         | `try_files $uri $uri/ /index.html` — deep links work                                           |
| Compression          | gzip for js/css/json/svg (add brotli with a brotli-enabled image)                              |
| Cache: hashed assets | `max-age=31536000, immutable` (`outputHashing: all` in prod builds)                            |
| Cache: index.html    | `no-cache, no-store` — deploys appear on next request                                          |
| Runtime config       | `/config/app-config.json`, generated at container start and never cached                       |
| Security headers     | generated from `security-headers.conf.template` (CSP, nosniff, referrer, permissions, framing) |
| Health check         | `GET /healthz` used by Docker HEALTHCHECK and orchestrators                                    |
| Non-root port        | listens on 8080 for container platforms that drop root                                         |

## Runtime configuration

The browser loads `config/app-config.json` before Angular bootstraps. The
nginx image generates that file from environment variables on every start,
so the same immutable image can be promoted through environments:

| Variable                | Default       | Format                              |
| ----------------------- | ------------- | ----------------------------------- |
| `APP_API_BASE_URL`      | `/api`        | Same-origin path or `http(s)` URL   |
| `APP_TRUSTED_ORIGINS`   | `[]`          | JSON array of bare absolute origins |
| `APP_SUPPORTED_LOCALES` | `["en","fr"]` | JSON array                          |
| `APP_DEFAULT_LOCALE`    | `en`          | Must appear in supported locales    |
| `APP_MOCK_API`          | `false`       | JSON boolean; keep false in prod    |
| `APP_CSP_CONNECT_SRC`   | `'self'`      | CSP `connect-src` source list       |

An absolute `APP_API_BASE_URL` must have its origin listed in
`APP_TRUSTED_ORIGINS` (otherwise the app refuses to start), and that same origin
must appear in `APP_CSP_CONNECT_SRC` or the browser will block every API call.
The generated app-config.json values are validated at startup.

For non-container hosting, replace `config/app-config.json` during deployment.
It may contain any subset of `AppConfig`; omitted keys use the safe defaults
from `app-config.ts`. A missing file (`404`) also uses defaults, while malformed
JSON, unknown keys, invalid origins, and other HTTP failures stop startup.

### Calling a cross-origin API

```bash
docker run --rm -p 8080:8080 \
  -e APP_API_BASE_URL=https://api.example.com/v1 \
  -e 'APP_TRUSTED_ORIGINS=["https://api.example.com"]' \
  -e APP_CSP_CONNECT_SRC="'self' https://api.example.com" \
  ddd-template-web:local
```

If you front the API with a same-origin reverse proxy, the defaults (`/api` and
`'self'`) are enough and no cross-origin policy is required.

## TLS and HSTS

Terminate TLS at your load balancer/CDN, then enable the commented
`Strict-Transport-Security` line (or the equivalent platform policy).

## Rollback strategy

Deploy immutable, tagged images (`git rev-parse --short HEAD`). Rollback is a
previous tag redeploy; index.html no-cache guarantees users pick up the swap.
