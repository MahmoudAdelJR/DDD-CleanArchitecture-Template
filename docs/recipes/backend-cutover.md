# Recipe: Go from fakes to a real backend (auth + data)

No page or store code changes — this is entirely composition-root work.

## 1. Point the runtime config at your API

Set `public/config/app-config.json` for local/static hosting, or the equivalent
deployment values described in `docs/recipes/runtime-config.md`:

```json
{
  "apiBaseUrl": "https://api.example.com",
  "trustedOrigins": ["https://api.example.com"],
  "mockApi": false
}
```

## 2. Real identity endpoints

Implement `AuthenticationPort` + `SessionRefreshPort`
(`features/auth/data-access/authentication.port.ts`,
`core/auth/session-refresh.port.ts`) once — e.g. `HttpAuthenticationAdapter`
calling `POST /auth/sign-in` / `POST /auth/refresh` and mapping responses to
`SessionPayload` (`user`, `accessToken`, `refreshToken`, `expiresAt` in ms).
Then swap the bindings in
`features/auth/data-access/auth-data-access.providers.ts`:

```ts
export function provideAuthDataAccess(): Provider[] {
  return [
    HttpAuthenticationAdapter,
    { provide: AUTHENTICATION_PORT, useExisting: HttpAuthenticationAdapter },
    { provide: SESSION_REFRESH_PORT, useExisting: HttpAuthenticationAdapter },
  ];
}
```

401 refresh-and-retry, single-flight coordination, trusted-origin token
attachment, and forced logout already work — see ADR-0004. If your backend
is cookie-based (BFF), remove the bearer attachment path, keep the 401
pipeline, and document the CSRF strategy in an ADR.

## 3. Real data access

`CustomerHttpRepository` (`features/customers/data-access/`) already
implements the port over `BaseHttpService`. Swap the binding:

```ts
const customersDataAccessProviders: Provider[] = [
  { provide: CUSTOMER_REPOSITORY, useClass: CustomerHttpRepository },
];
```

Do the same for every generated slice. Then re-point that slice's
`*.contract.spec.ts` at a staging backend (or generated OpenAPI client) to
detect drift against the pinned transport shape.

## 4. Develop against fixtures without a backend

Set `mockApi: true` in a dev config. `src/app/dev/mock-api.interceptor.ts`
answers `/api/customers` (list + detail, with pagination and 404 Problem
Details) from `mock-fixtures.ts` — with the real interceptor pipeline
loading/error/auth/correlation running around it. Add routes to the
`MOCK_ROUTES` table; keep `dev/` free of feature imports (zone-enforced).

## 5. Server errors in forms

`applyServerValidationErrors(form, apiError)` maps
Problem Details `errors` (ASP.NET dictionary or array shapes) onto controls;
render with `<app-field-error>`.
