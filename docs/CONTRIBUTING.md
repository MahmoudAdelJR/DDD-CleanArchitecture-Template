# Contributing

## First 10 minutes

```bash
npm ci
npm start        # http://localhost:4200
# demo logins: admin@demo.local / Admin123! · reader@demo.local / Reader123!
```

Understand the layer model and the dependency table in
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md); decisions live in
[`docs/adr/`](docs/adr/).

## Adding a feature (the blessed path)

```bash
npm run gen:feature -- orders            # CRUD slice
npm run gen:feature -- invoices --workflow  # slice with domain invariants
npm run gen:page   -- orders approve
```

Generated slices ship wired route + boundary zone + store + port/adapter +
specs, and the generator verifies typecheck, lint, and tests before exiting.
Hand-built slices are accepted only if they match the generated shape.

## Before opening a PR (local gates — CI runs the same)

- [ ] `npm run check:architecture` (slices wired: folder ↔ zone ↔ lazy route)
- [ ] `npm run format:check` (or `npm run format`)
- [ ] `npm run lint` (includes import-boundary rules)
- [ ] `npm run typecheck` (app, specs, e2e)
- [ ] `npm run test:ci` (coverage line gate ≥ 80%)
- [ ] `npm run build` (bundle budgets enforced)
- [ ] `npm run e2e` when flows/UX changed
- [ ] `node scripts/audit-allowlist.mjs` when dependencies changed

## PR checklist

- One vertical capability per PR; screenshot/recording for UI changes.
- New user-facing strings go into `core/i18n/locale-catalog.ts` (all locales),
  never hardcode English in templates of existing slices.
- New permissions: add to `core/authorization/app-permissions.ts` AND note in
  the PR that the server enforces them independently.
- Architecture-affecting choices (state, deps, pipeline order, boundaries):
  add an ADR before implementing.
- Tests: every store/port/interceptor/guard change ships with a spec;
  cross-slice contracts get a `*.contract.spec.ts`.
- If a new feature folder was created manually, add its ESLint zone and
  route entry — CI fails otherwise.

## Conventions that reviewers enforce

- `shared/` stays app-pure (no core/feature imports — the lint rule is the
  law; ports defined in shared may be implemented by core).
- Feature folders never import sibling features (zone rule) or `dev/`.
- Ports + `InjectionToken` per slice; swap adapters at provider level only.
- Guards/permission directives are UX; authorization decisions belong to the
  backend (see `SECURITY.md`).
- Zoneless + signals first; no new RxJS-heavy abstractions without a reason.

## Release & upgrade hygiene

- Framework updates ride the caret within the current major
  (`npm update @angular/core` style); majors go through `ng update` in a
  dedicated PR with an ADR when breaking.
- Dependabot updates grouped in `.github/dependabot.yml`; merge only with
  green gates.
- Dev-only advisory exceptions require `audit-allowlist.json` entry with
  `reason`, `devOnly: true`, and a real `expires`.
