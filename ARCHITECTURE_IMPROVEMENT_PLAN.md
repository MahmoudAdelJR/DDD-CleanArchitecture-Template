# Architecture Improvement Plan

## 1. Purpose

This document defines the path for evolving this repository from an Angular scaffold into a production-ready template for medium and enterprise applications.

The target is an opinionated but pragmatic template that provides:

- Modular vertical slices with enforceable boundaries
- Clean separation of platform, shell, features, and genuinely shared UI
- DDD patterns where business complexity justifies them
- Secure authentication and authorization integration
- Accessible and reusable presentation foundations
- Strong testing, delivery, observability, and security defaults
- A clear developer workflow supported by examples and generators

The template should avoid adding abstractions merely to appear comprehensive. Every shared abstraction must solve a demonstrated cross-feature problem.

## 2. Current Assessment

### Overall status

The repository is currently a modern Angular 20 scaffold with several useful cross-cutting primitives. It does not yet demonstrate DDD, Clean Architecture, or vertical slices because its routes and feature areas are empty.

| Area                               | Current status             |
| ---------------------------------- | -------------------------- |
| Angular foundation                 | Good                       |
| TypeScript and template strictness | Good                       |
| Cross-cutting primitives           | Promising but incomplete   |
| Modular vertical slices            | Not implemented            |
| DDD                                | Not implemented            |
| Clean Architecture                 | Interfaces and naming only |
| Security                           | Significant gaps           |
| Testing and automation             | Very weak                  |
| Enterprise readiness               | Not currently suitable     |

### Existing strengths

- Angular standalone bootstrapping
- Functional guards and interceptors
- Zoneless change detection
- Fetch-backed `HttpClient`
- Strict TypeScript and Angular template settings
- Production output hashing and basic bundle budgets
- Signals as a lightweight state-management foundation
- Concurrent-request-safe loading counter
- Error propagation after global HTTP handling
- Small initial dependency footprint

### Highest-risk gaps

- No working application routes or feature slices
- No implemented domain behavior, use cases, repositories, or adapters
- Generated Angular welcome page remains the application UI
- Incomplete and publicly mutable authentication state
- Bearer token is attached without restricting requests to trusted API origins
- No token expiry, refresh, restoration, or 401 recovery flow
- Console-only notifications
- Fragile API error parsing
- No runtime environment configuration
- No architecture boundary enforcement
- No linting, meaningful tests, E2E tests, or CI/CD
- No production hosting, security headers, or observability strategy
- Boilerplate documentation that does not explain the intended architecture

## 3. Architectural Principles

### 3.1 Organize by business capability

Features should be the primary unit of organization and ownership. A feature owns its routes, UI, state, API integration, transport contracts, mapping, and tests unless an element has proven reuse across independent features.

### 3.2 Use vertical slices pragmatically

A slice should represent a user-visible capability or use case, such as:

- Sign in
- View customer list
- Edit customer
- Submit an order
- Approve an invoice

Simple CRUD screens should remain simple. They do not need ceremonial domain, repository, and use-case classes when direct feature-owned API composition is sufficient.

### 3.3 Apply DDD selectively

Use richer DDD patterns for workflows with meaningful invariants and business behavior:

- Aggregates
- Value objects
- Domain policies
- Domain events
- Factories
- Feature-owned repository ports

Do not model all API records as domain entities. Query and reference-data screens often only need typed transport and presentation models.

### 3.4 Keep shared code small and stable

Code should only move into `shared` after at least two independent features demonstrate the same semantics. Similar-looking code is not necessarily reusable code.

### 3.5 Enforce dependency direction

The intended dependency direction is:

```text
app composition -> shell, platform, features
shell           -> platform, shared
features        -> platform contracts, shared
shared          -> Angular/CDK and business-agnostic dependencies only
platform        -> external infrastructure and application-wide adapters
```

Rules:

- One feature must not import another feature's internals.
- `shared` must not depend on features or concrete platform services.
- Domain code must not depend on Angular UI or HTTP concerns.
- Infrastructure implementations should depend on feature-owned contracts, not the reverse.
- Cross-cutting services should expose replaceable contracts where replacement or testing provides real value.

## 4. Target Structure

```text
src/app/
  app.config.ts
  app.routes.ts

  platform/
    auth/
    configuration/
    http/
    logging/
    storage/
    telemetry/

  shell/
    application-shell/
    authenticated-layout/
    public-layout/
    navigation/
    error-pages/

  features/
    identity/
      sign-in/
        sign-in.page.ts
        sign-in.form.ts
        sign-in.store.ts
        sign-in.api.ts
        sign-in.models.ts
        sign-in.spec.ts
      profile/
      identity.routes.ts

    customers/
      customer-list/
      customer-details/
      edit-customer/
      shared/
        customer.ts
        customer.api.ts
      customers.routes.ts

    orders/
      create-order/
      approve-order/
      domain/
      data-access/
      orders.routes.ts

  shared/
    ui/
    forms/
    accessibility/
    primitives/
```

Each top-level feature should be lazy-loaded and expose only its route entry point or an explicit public API. Route-level providers should scope feature state and infrastructure where possible.

## 5. Shared Layer Plan

### 5.1 UI foundation

Implement a small accessible UI foundation driven by actual reference features:

- Button and icon button
- Form field and field-error display
- Input, select, checkbox, radio, and textarea controls
- Alert and toast host
- Spinner, progress indicator, and skeleton
- Empty state
- Error state with retry action
- Confirmation dialog
- Pagination
- Data-table primitives
- Breadcrumbs and page header
- Visually hidden utility
- Responsive container and layout primitives

Add semantic design tokens for:

- Color
- Typography
- Spacing
- Radius
- Elevation
- Motion
- Focus
- Light, dark, and high-contrast themes where required

Do not build replacements for mature Angular CDK capabilities without a specific requirement.

### 5.2 Forms

Add forms infrastructure around concrete forms:

- Typed validation error model
- Localized validation-message resolver
- Field error component
- Validation summary
- Server validation-error mapper
- Cross-field validator examples
- Trimmed-required validator
- Matching-fields validator
- Date-range validator
- Password-policy integration point
- Unsaved-changes guard
- Submit-state and duplicate-submission handling

Avoid creating a custom forms framework or deeply generic form configuration DSL.

### 5.3 Directives

Potential high-value directives include:

- Permission directive supporting `any` and `all` policies
- Focus-first-invalid directive
- Conditional initial-focus directive with browser and accessibility guards
- Prevent-double-submit behavior
- Feature-flag directive if feature flags are supported
- Click-outside directive only when the selected UI library does not provide one

The permission directive should belong to the authorization capability or depend on an authorization contract. It should not make generic shared code depend on a concrete core service.

The existing unconditional autofocus directive should be redesigned or removed because forced focus can harm accessibility.

### 5.4 Pipes

Keep shared pipes pure, display-focused, and locale-aware:

- Date/time formatting based on `LOCALE_ID`
- Date-only formatting distinct from instant/date-time formatting
- Relative date/time formatting when product requirements justify it
- File-size formatting
- Empty-value display fallback

Avoid generic filtering, sorting, or search pipes. These can be inefficient and hide business behavior in templates. Enum and permission labels should normally remain feature-owned.

### 5.5 Accessibility

Add the following platform and shared accessibility capabilities:

- Skip link and main-content target
- Route-change focus management
- Focus-visible styles
- Dialog focus trapping and restoration
- Accessible notification and loading live regions
- Validation summaries and field-error associations
- Reduced-motion support
- Automated accessibility tests

### 5.6 Configuration and tokens

Introduce typed injection tokens or contracts for:

- Runtime application configuration
- API base URL and trusted API origins
- Supported locales and default locale
- Date formats and timezone
- Storage adapter
- Notification adapter
- Logger and telemetry adapter
- Feature-flag provider

Introduce HTTP context tokens for:

- Skipping authentication
- Skipping the global loading indicator
- Suppressing global error notifications
- Selecting a loading scope
- Declaring retry eligibility

## 6. Existing Abstractions to Reconsider

The following abstractions are currently speculative and unused:

- Generic `UseCase<TRequest, TResponse>`
- Generic CRUD `Repository`
- `Mapper` and `BiMapper`
- Universal `Entity` and `AuditableEntity`
- Global pagination models
- Global `SelectOption`

Required actions:

- Move repository contracts into the feature/domain that owns them.
- Prefer mapping functions unless class-based mapping provides demonstrated value.
- Avoid a universal CRUD repository that erases aggregate-specific behavior.
- Move API pagination contracts near data-access code unless semantics are genuinely universal.
- Move `SelectOption` to forms/UI if multiple controls actually share it.
- Remove unused abstractions that are not validated by reference features.

## 7. Security Plan

### Authentication and session lifecycle

- Make writable session signals private.
- Expose readonly signals and computed authentication state.
- Define the authoritative session model and prevent contradictory state.
- Add startup session restoration.
- Define access-token expiry and refresh behavior.
- Coordinate concurrent refresh requests.
- Handle revoked or invalid sessions.
- Clear the session and redirect safely when recovery fails.
- Preserve return URLs when authentication is required.
- Define cross-tab synchronization behavior.
- Document token storage and threat-model tradeoffs.

### HTTP credential safety

- Attach credentials only to configured trusted API origins.
- Add explicit request opt-out or opt-in through `HttpContextToken`.
- Exclude sign-in, refresh, and external endpoints as appropriate.
- Prevent recursive refresh interception.
- Validate and normalize API URLs through runtime configuration.

### Authorization

- Treat guards and permission directives as UX controls only.
- Document that the server must authorize every protected operation.
- Replace arbitrary permission strings with typed constants where practical.
- Support route policies for one, any, or all required permissions.
- Add a dedicated forbidden route.

### Hosting security

Provide a production hosting example with:

- Content Security Policy
- `frame-ancestors` or equivalent framing protection
- Referrer Policy
- Permissions Policy
- HSTS at the TLS termination layer
- MIME-sniffing protection
- Safe cache policies for HTML and hashed assets
- SPA fallback routing
- Compression

## 8. HTTP and Error-Handling Plan

- Add validated runtime API configuration.
- Prefer feature-owned API clients or generated OpenAPI clients over inheritance from a generic base service.
- Preserve access to complete `HttpClient` request options and context.
- Define query serialization for arrays, dates, booleans, and nested filters.
- Normalize API errors into a stable application model.
- Support RFC Problem Details and ASP.NET validation dictionaries.
- Map safe user-facing messages separately from diagnostic details.
- Extract correlation and trace identifiers.
- Define behavior for network failures, 401, 403, 404, 409, 422, 429, and 5xx responses.
- Allow features to suppress or override global notifications.
- Avoid duplicate notifications between interceptors and feature code.
- Define request cancellation, timeout, retry, and idempotency policies.

## 9. Localization Plan

Select one coherent localization strategy and use it across templates, requests, validation, dates, numbers, and document metadata.

Required capabilities:

- Supported locale configuration
- Persisted language preference through a storage abstraction
- Runtime or build-time translation strategy
- Dynamic document `lang` and direction
- RTL support where required
- Locale registration
- `LOCALE_ID` integration
- Locale-aware date, number, and currency formatting
- Localized validation and error messages
- Validated `Accept-Language` request header
- Fallback locale behavior
- Localization tests

Separate calendar-date values from date-time instants. Do not convert local date-only values through UTC `toISOString()`.

## 10. State-Management Plan

- Use component signals for local UI state.
- Use feature-scoped signal stores/services for multi-component workflows.
- Keep server state and client workflow state conceptually separate.
- Introduce a larger state library only when coordination, debugging, or caching requirements justify it.
- Expose readonly state and explicit commands.
- Derive state with `computed()` instead of maintaining duplicate booleans.
- Define patterns for loading, error, empty, and success states.
- Provide examples for cancellation, optimistic updates, and stale-data handling only where needed.

## 11. Testing Strategy

### Unit tests

Cover:

- Domain invariants and value objects
- Feature state transitions
- Session state and token lifecycle
- Permission policies
- Error normalization
- Query serialization
- Date-only and timezone behavior
- Validators and server-error mapping

### Angular integration tests

Cover:

- Route guards and redirects
- Interceptor ordering and HTTP context opt-outs
- Trusted-origin credential attachment
- Concurrent loading requests
- Permission directive reactivity
- Form submission and server validation
- Notification and loading presentation

### End-to-end tests

Add a deterministic E2E framework and cover critical paths:

- Sign in and sign out
- Session restoration
- Protected-route redirects
- Permission denial
- One complete create/update workflow
- Global error and offline behavior

### Additional quality checks

- Accessibility tests with axe or equivalent
- API contract tests or generated-client verification
- Visual regression for core shared components where valuable
- Coverage thresholds focused on business-critical code
- Production build and bundle-budget verification in CI

## 12. Tooling and Boundary Enforcement

- Add ESLint for TypeScript and Angular templates.
- Add import/dependency-boundary rules.
- Add formatting and formatting-check scripts.
- Add deterministic CI test scripts with browser headless mode.
- Add explicit type-check scripts.
- Add `engines` and `packageManager` declarations.
- Define supported Node and npm versions.
- Add dependency update automation.
- Add secret scanning, SAST, dependency scanning, and license checks.
- Generate an SBOM for releases where required.
- Keep build and test commands reproducible through `npm ci`.

Boundary rules should prevent:

- Feature-to-feature internal imports
- Shared-to-feature imports
- Domain-to-Angular or domain-to-HTTP imports
- Presentation code importing infrastructure internals
- Deep imports that bypass a feature's public API

## 13. Observability and Operations

- Define a structured logger contract.
- Add production and development logger adapters.
- Redact access tokens, credentials, and sensitive personal data.
- Integrate browser error and unhandled rejection reporting.
- Attach release and environment metadata.
- Propagate or capture correlation and trace identifiers.
- Add real-user monitoring only through a replaceable adapter.
- Provide source-map upload guidance without serving public production source maps.
- Document alerting ownership and incident diagnostics.
- Add deployment health checks at the hosting/infrastructure layer.

## 14. Deployment Plan

Provide at least one production deployment reference containing:

- Multi-stage container build or equivalent immutable artifact process
- Static web server configuration
- SPA fallback routing
- Compression
- Immutable caching for hashed assets
- No-cache or short-cache policy for the application HTML
- Runtime configuration injection strategy
- Security headers
- Health endpoint at the hosting layer
- Rollback guidance

Keep SSR and PWA as optional recipes. Add them only when SEO, first-render, offline, or installability requirements justify their complexity.

## 15. Documentation and Developer Experience

Replace the generated README with documentation covering:

- Project purpose and supported use cases
- Prerequisites and supported tool versions
- Local setup and runtime configuration
- Architectural overview and dependency rules
- How to create a feature slice
- When to use simple slices versus rich domain modeling
- Authentication and authorization model
- API and error-handling conventions
- Testing strategy and commands
- Production build and deployment
- Troubleshooting

Add:

- Architecture decision records
- Contribution guide
- Security policy
- Coding conventions
- Release and upgrade guide
- Architecture diagrams
- Pull-request checklist
- Feature-slice checklist

## 16. Template Differentiators

The template should provide value through executable guidance rather than a large collection of placeholders.

Recommended differentiators:

- One complete authentication slice
- One complete CRUD/reference-data slice
- One workflow with real business invariants demonstrating DDD
- A documented decision guide for simple versus rich slices
- Feature and slice generators
- Enforced dependency boundaries
- Replaceable configuration, storage, notification, logging, and telemetry adapters
- Development mock API and fixtures
- Typed API error normalization
- Feature-flag example
- Accessible design-system starter
- Tests at every architectural level
- Deployment recipes
- ADR and architecture-review templates

## 17. Phased Delivery Roadmap

### Phase 1: Make the architecture executable

**Status: implemented (2026-10-16).** Sign-in, customers (list + detail), and identity profile slices are live behind lazy routes with route-scoped providers; guards redirect to real `/login` (with `returnUrl`) and `/forbidden`.

Goal: demonstrate the intended structure through working software.

- Replace the generated welcome page with an application shell.
- Add public, authenticated, forbidden, and not-found routes.
- Standardize on standalone routes and components.
- Implement a complete sign-in slice.
- Implement one protected feature from route through API adapter.
- Add lazy loading and route-level providers.
- Correct route naming issues, including `identiy.routes.ts`.
- Define initial dependency rules.
- Remove or relocate abstractions that the reference slices do not validate.

Exit criteria:

- A developer can run the application and navigate through public and protected routes.
- At least one feature demonstrates the intended vertical-slice conventions.
- No undefined guard redirect targets remain.

### Phase 2: Secure the platform

**Status: implemented (2026-10-16).** Runtime config with startup validation, trusted-origin-only credentials with `SKIP_AUTH`/`SKIP_LOADING`/`SUPPRESS_GLOBAL_ERROR` context tokens, persisted/restored session with expiry + single-flight refresh on 401 (refresh-and-retry pipeline `loading -> error -> language -> auth`), `ApiError` normalization covering RFC 7807 and ASP.NET dictionary validation shapes, status-specific safe messaging with correlation-id capture, accessible toast notification host and flicker-delayed loading bar. 34 unit tests green; the refresh, session, and both interceptor suites assert the plan's exit criteria (untrusted origins never receive tokens; reload preserves auth; concurrent 401s share one refresh; failures surface as accessible toasts).

Goal: establish safe authentication, HTTP, and error-handling defaults.

- Add validated runtime configuration.
- Redesign session state around private writable signals.
- Restrict credentials to trusted origins.
- Add HTTP context controls.
- Implement session restoration, expiry, refresh, and logout.
- Normalize API errors.
- Add accessible notification and loading hosts.
- Add status-specific HTTP policies.
- Add authentication and interceptor tests.

Exit criteria:

- Tokens cannot be sent to untrusted origins.
- Authentication survives reload according to the documented policy.
- Concurrent refresh and failure behavior are tested.
- Users receive safe and accessible error feedback.

### Phase 3: Establish shared foundations

**Status: implemented (2026-10-16).** Semantic design tokens with automatic dark theme (`prefers-color-scheme` + `data-theme` override), global focus-visible and reduced-motion handling. Shared layer is now app-pure: `shared` no longer imports anything from `core` (verified by audit) — notification/loading hosts moved to `core/ui`, and `HasPermissionDirective` moved to `core/authorization` with single/list all-of/any-of policies, an `else` template, and view preservation across permission changes. Typed form infrastructure: `trimmedRequired`/`matchingFields`/`dateRange`, localized `ValidationMessageResolver`, accessible `app-field-error` with `aria-describedby`/`aria-invalid` wiring, and `applyServerValidationErrors` mapping `ApiError.validationErrors` onto controls. Localization is coherent end to end: `TRANSLATION` port (shared) with a `LocaleService` platform adapter (persisted preference, validated against `AppConfig.supportedLocales`, document lang/dir + RTL sync, `LOCALE_ID` + `Accept-Language` + catalog-driven validation/HTTP/auth messages, en/fr demo catalogs, runtime switcher). Date semantics split: calendar strings parse to local midnight (no UTC drift), instants render in viewer TZ, locale-reactive `appDateFormat`. Accessibility: `RouteFocusManager` moves focus to `#main` per navigation, skip link, live-region hosts. 69 tests green (9 new Phase-3 suites covering i18n fallback/interpolation/persistence, timezone-safe dates, validators, server-error mapping, permission directive reactivity, route focus).

Goal: provide a coherent but minimal UI and forms foundation.

- Add semantic design tokens.
- Add core accessible UI primitives.
- Add typed form-error infrastructure.
- Implement localization consistently.
- Add route focus management and accessibility utilities.
- Redesign authorization directives and route policies.
- Separate date-only and instant handling.
- Add component, form, and accessibility tests.

Exit criteria:

- Reference features use shared UI without feature leakage.
- Shared code has no dependency on feature internals.
- Forms, validation, dates, and notifications are accessible and localized.

### Phase 4: Enforce quality and operations

**Status: implemented (2026-10-16).** ESLint 9 flat config with Angular code+template rules and resolved-path boundary enforcement (`import/no-restricted-paths` zones for shared/core/shell/feature-crossing — verified firing). Prettier format + format:check scripts. Deterministic scripts (`lint`, `typecheck` for app/specs/e2e, `test:ci` with coverage, `audit:ci`, `audit:gate`), `engines` + `packageManager` pinned. Playwright E2E (12 scenarios incl. the Phase-2 exit criteria: reload persistence, trusted-permission UX, i18n persistence) runs on system Chrome with traces. Contract suite pins the customer transport shape (it already caught a detail-leak in the fake adapter). Observability: `LOGGER` port with redacting structured console adapter, `ErrorHandler` funnel, `TELEMETRY` replaceable sink, and a per-session `x-correlation-id` interceptor (pipeline now `loading -> error -> language -> correlation -> auth`). GitHub Actions CI gates PRs on format/lint/architecture/typecheck/tests/80%-coverage/build-budgets/audit (prod zero-highs; dev-only advisories fail closed unless allowlisted with reason + expiry) plus an e2e job with report artifacts; Dependabot for npm + actions. Production hosting reference in `deploy/` (multi-stage Docker → nginx with SPA fallback, immutable asset caching, no-cache HTML, gzip, CSP/security headers, /healthz, rollback guidance). Angular patched to 20.3.34 — `npm audit --omit=dev` now reports zero vulnerabilities. Verified locally: format ✅ lint ✅ typecheck ✅ 86 unit tests ✅ 87.7% lines ✅ prod build ✅ 12/12 E2E ✅ audit gates ✅.

Goal: make every release reproducible and observable.

- Add ESLint, formatting, and boundary rules.
- Add CI for install, type checking, linting, tests, coverage, and build.
- Add E2E and contract testing.
- Add dependency and security scanning.
- Add structured logging and telemetry integration points.
- Add production hosting and security-header examples.
- Add bundle and performance checks.

Exit criteria:

- Pull requests cannot merge when architecture or quality gates fail.
- A production artifact is built and tested reproducibly.
- Runtime failures include safe diagnostic context.

### Phase 5: Complete the template experience

**Status: implemented (2026-10-16).** Self-verifying generators: `npm run gen:feature -- <name> [--workflow]` scaffolds a complete conventions-compliant slice (routes + route-scoped providers, port/token, in-memory adapter with latency, signal store, list+detail pages using the shared a11y primitives, specs, optional `domain/` transition-invariants module with policy tests) and mechanically inserts the lazy route (`// gen:app-route` marker) and cross-feature ESLint zone (`// gen:feature-zones` marker) before re-running typecheck, lint and the full unit suite — failing with revert instructions otherwise (it caught and fixed its own template bugs during validation). `gen:page` adds pages with static-before-param route ordering. `scripts/check-architecture.mjs` (+CI step) fails the build when a feature folder lacks its zone or route wiring. Dev mock API: `src/app/dev/mock-api.interceptor.ts` + fixtures answer trusted `/api` requests when `AppConfig.mockApi` is true (dormant default; zone-enforced so no app code may import `dev/`), and `CustomerHttpRepository` now proves the real HTTP adapter path over `BaseHttpService` (404→`CustomerNotFoundError`, query serialization) with specs — the fakes-to-backend cutover is one provider line (`docs/recipes/backend-cutover.md`). Documentation completed: `docs/adr/` (index, template, ADR-0001..0005), `docs/CONTRIBUTING.md` (first-10-minutes, slice workflow, PR/local gate checklists, reviewer conventions), `docs/SECURITY.md` (threat-model posture, hardening inventory, reporting process), recipes for backend cutover, feature flags, SSR and PWA. Template validated by generating the `tasks --workflow` slice and `tasks archive` page end-to-end through every gate, then removing the sample. Final state: 95/95 unit tests, 88.4% line coverage (gate 80), 12/12 E2E, lint/typecheck/format/build-budget/audit gates all green.

Goal: make correct usage faster than incorrect usage.

- Add generators for features, slices, pages, API clients, and domain workflows.
- Complete architecture and contribution documentation.
- Add ADR and review templates.
- Add development fixtures and mock API support.
- Add optional SSR, PWA, feature-flag, and alternate-auth recipes.
- Validate the template by creating a small sample application from scratch.

Exit criteria:

- A new developer can create a compliant feature without studying the entire repository.
- Generated code follows all dependency and testing conventions.
- Optional capabilities do not increase the default application's complexity.

## 18. Prioritized Backlog

### P0: Foundation and release blockers

- Replace generated root UI.
- Define working routes and layouts.
- Implement one complete vertical slice.
- Restrict bearer-token attachment.
- Redesign session state.
- Add runtime configuration.
- Add real notification and loading UI.
- Add CI and deterministic tests.

### P1: Enterprise baseline

- Add refresh and 401 coordination.
- Normalize API errors.
- Add ESLint and boundary enforcement.
- Add meaningful unit and integration coverage.
- Add E2E tests.
- Add accessible forms and feedback components.
- Add coherent localization.
- Add production deployment reference.
- Add logging and telemetry adapters.

### P2: Developer productivity

- Add feature generators.
- Add OpenAPI generation or contract validation.
- Add mock API and fixtures.
- Add dependency automation and security scans.
- Add architecture documentation and ADRs.
- Add optional feature flags.

### P3: Requirement-dependent capabilities

- SSR and hydration
- PWA and offline support
- Advanced data-grid facilities
- Visual regression infrastructure
- Multi-tenant support
- Micro-frontend composition

These should only be implemented when application requirements justify them.

## 19. Definition of Production Ready

The template can be described as production ready when:

- At least two complete vertical slices demonstrate the architecture.
- One slice demonstrates meaningful domain behavior.
- Architectural boundaries are automatically enforced.
- Authentication lifecycle and trusted-origin behavior are tested.
- Runtime configuration is validated before application startup.
- API errors are safely normalized and observable.
- Critical paths have unit, integration, E2E, and accessibility coverage.
- CI produces a reproducible production artifact.
- Security, dependency, and license checks are automated.
- Production hosting and security-header guidance is included.
- Logging and telemetry do not expose sensitive data.
- Documentation enables a new developer to add a compliant feature.
- Shared abstractions are supported by demonstrated reuse.
- Optional features remain optional and do not burden the default setup.

## 20. Immediate Next Step

Implement one thin but complete reference slice, preferably sign-in plus one protected business feature. This should include routing, presentation, feature state, API integration, error handling, authorization, and tests.

That implementation should be used to validate the proposed boundaries before adding more shared abstractions. It will reveal which concepts are genuinely reusable and which should remain local to a feature.
