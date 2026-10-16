# DDD Clean Architecture Template

An Angular 20 vertical-slice template: lazy feature modules, ports & adapters,
secure session lifecycle, typed error handling, i18n, a11y, and a full quality
gate pipeline. See `docs/ARCHITECTURE.md` for the rules and
`ARCHITECTURE_IMPROVEMENT_PLAN.md` for the roadmap.

## Quick start

```bash
npm ci
npm start          # http://localhost:4200
```

Demo accounts (the app runs against in-memory fake adapters, no backend needed):

| Email             | Password   | Access                 |
| ----------------- | ---------- | ---------------------- |
| admin@demo.local  | Admin123!  | customers read + write |
| reader@demo.local | Reader123! | customers read only    |

## Commands

| Task                                                | Command                                                 |
| --------------------------------------------------- | ------------------------------------------------------- |
| Dev server                                          | `npm start`                                             |
| Production build (bundle budgets enforced)          | `npm run build`                                         |
| Unit tests (interactive)                            | `npm test`                                              |
| Unit tests + coverage (CI mode)                     | `npm run test:ci`                                       |
| Lint incl. architecture boundaries                  | `npm run lint`                                          |
| Formatting                                          | `npm run format` / `npm run format:check`               |
| Typecheck app, specs, and e2e                       | `npm run typecheck`                                     |
| E2E (Playwright, auto-starts a dev server on :4300) | `npm run e2e`                                           |
| Scaffold a new vertical slice                       | `npm run gen:feature -- orders [--workflow]`            |
| Add a page to an existing slice                     | `npm run gen:page -- orders approve`                    |
| Slice wiring integrity check                        | `npm run check:architecture`                            |
| Dependency audit gates                              | `npm run audit:ci` + `node scripts/audit-allowlist.mjs` |

Supported runtimes are declared in `package.json` (`engines`, `packageManager`);
always install with `npm ci` for reproducible trees.

## Documentation

- `docs/ARCHITECTURE.md` — layer model, dependency rules, HTTP pipeline, i18n, session lifecycle
- `docs/adr/` — architectural decision records (why things are the way they are)
- `docs/CONTRIBUTING.md` — first-10-minutes guide and PR gate checklist
- `docs/SECURITY.md` — threat model notes and hardening posture
- `docs/recipes/` — backend cutover, feature flags, SSR, PWA
- `deploy/` — containerized nginx production reference
- `ARCHITECTURE_IMPROVEMENT_PLAN.md` — the roadmap this template was built from

## Container / hosting reference

`deploy/Dockerfile` + `deploy/nginx.conf` provide a production-ready static
hosting example (SPA fallback, immutable hashed-asset caching, gzip, security
headers, health check). See `deploy/README.md`.

## Original CLI notes

This project was generated with the [Angular CLI](https://github.com/angular/angular-cli);
generic guidance lives in the Angular docs (`ng generate --help`, etc.).

## License

Licensed under the [MIT License](LICENSE).
