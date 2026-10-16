# DDD Clean Architecture Template

An Angular 20 vertical-slice template: lazy feature modules, ports & adapters,
secure session lifecycle, typed error handling, i18n, a11y, and a full quality
gate pipeline. Correct usage is one command (`npm run gen:feature`), and the
boundaries are machine-enforced — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- Node.js `^20.19.0 || ^22.12.0 || >=24.0.0`
- npm (install with `npm ci` — `package-lock.json` is the source of truth)
- Google Chrome (required by the Karma unit-test and Playwright E2E runs)

## Start here (adopting the template)

1. Click **Use this template** → _Create a new repository_ (or clone and remove
   the demo slices later once you know the layout).
2. Install and run everything once to confirm a green baseline:

   ```bash
   npm ci
   npm run check:architecture
   npm run lint
   npm run typecheck
   npm run test:ci
   npm run build
   npm run e2e
   ```

3. Start the app and explore the demo flows:

   ```bash
   npm start          # http://localhost:4200
   ```

   The app runs against in-memory fake adapters — no backend needed.

   | Email             | Password   | Access                 |
   | ----------------- | ---------- | ---------------------- |
   | admin@demo.local  | Admin123!  | customers read + write |
   | reader@demo.local | Reader123! | customers read only    |

4. Customize before your first real feature:
   - [ ] App name: `index.html` title, `app.title` in
         [locale catalogs](src/app/core/i18n/locale-catalog.ts), `package.json`,
         and the project key in `angular.json` (keep the CI/Docker artifact paths
         in sync when you rename it)
   - [ ] Runtime config: `apiBaseUrl`, `trustedOrigins`, locales in
         [app-config.ts](src/app/core/config/app-config.ts)
   - [ ] Backend: follow [docs/recipes/backend-cutover.md](docs/recipes/backend-cutover.md)
   - [ ] Deployment: [deploy/](deploy/README.md) (nginx reference)
   - [ ] Security contact: [docs/SECURITY.md](docs/SECURITY.md)

5. Add your first slice — the generator wires the route, the ESLint boundary
   zone, and re-runs the gates for you:

   ```bash
   npm run gen:feature -- orders             # CRUD slice
   npm run gen:feature -- invoices --workflow  # + domain invariants
   npm run gen:page -- orders approve
   ```

## Commands

| Task                                                | Command                                      |
| --------------------------------------------------- | -------------------------------------------- |
| Dev server                                          | `npm start`                                  |
| Production build (bundle budgets enforced)          | `npm run build`                              |
| Unit tests (interactive)                            | `npm test`                                   |
| Unit tests + coverage (CI mode)                     | `npm run test:ci`                            |
| Lint incl. architecture boundaries                  | `npm run lint`                               |
| Formatting                                          | `npm run format` / `npm run format:check`    |
| Typecheck app, specs, and e2e                       | `npm run typecheck`                          |
| E2E (Playwright, auto-starts a dev server on :4300) | `npm run e2e`                                |
| Scaffold a new vertical slice                       | `npm run gen:feature -- orders [--workflow]` |
| Add a page to an existing slice                     | `npm run gen:page -- orders approve`         |
| Slice wiring integrity check                        | `npm run check:architecture`                 |
| Dependency audit gates                              | `npm run audit:ci` + `npm run audit:gate`    |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layer model, dependency rules, HTTP pipeline, i18n, session lifecycle
- [docs/adr/](docs/adr/README.md) — architectural decision records (why things are the way they are)
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) — first-10-minutes guide and PR gate checklist
- [docs/SECURITY.md](docs/SECURITY.md) — threat model notes and hardening posture
- [docs/recipes/](docs/recipes/) — backend cutover, feature flags, SSR, PWA
- [deploy/](deploy/README.md) — containerized nginx production reference
- [CHANGELOG.md](CHANGELOG.md) — release history
- [ARCHITECTURE_IMPROVEMENT_PLAN.md](ARCHITECTURE_IMPROVEMENT_PLAN.md) — historical roadmap the template was built from (kept for rationale; phases are all implemented)

## When this template fits (and when it doesn't)

- Fits: line-of-business SPA teams that want DDD-flavored vertical slices,
  strict layer boundaries, and generators that enforce the house style.
- Doesn't fit: Angular Universal-first content sites (see the SSR recipe),
  micro-frontends, or teams that want Nx-style monorepo tooling.
- Server responsibilities stay server-side: the guards and permission
  directives here are UX only (see [docs/SECURITY.md](docs/SECURITY.md)).

## Original CLI notes

This project was generated with the [Angular CLI](https://github.com/angular/angular-cli);
generic guidance lives in the Angular docs (`ng generate --help`, etc.).

## License

Licensed under the [MIT License](LICENSE).
