# Recipe: Feature flags

Small, dependency-free, port-shaped. Lives beside the other platform
adapters; nothing in `shared/` imports it.

```ts
// src/app/core/flags/flags.port.ts
import { InjectionToken } from '@angular/core';

export interface FeatureFlagsPort {
  isEnabled(flag: string): boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlagsPort>(
  'core.FeatureFlags',
  { factory: () => new StaticFlags({}) }, // default: everything off
);
```

```ts
// src/app/core/flags/static-flags.adapter.ts
export class StaticFlags implements FeatureFlagsPort {
  constructor(private readonly values: Record<string, boolean>) {}
  isEnabled(flag: string): boolean {
    return this.values[flag] === true;
  }
}
```

```ts
// src/app/core/authorization/has-feature.directive.ts — mirrors
// HasPermissionDirective but evaluates FeatureFlagsPort instead.
```

Usage at the composition root:

```ts
{ provide: FEATURE_FLAGS, useValue: new StaticFlags({ ordersExport: true }) }
```

```html
<button *appHasFeature="'ordersExport'">Export</button>
```

Productionizing ideas (each deserves an ADR): fetch flags at bootstrap in a
second `provideAppInitializer` and cache per session; URL/query override for
QA; a `FlagsContext` `HttpContextToken` to send flag sets to your backend for
server-side gating of the same capability. Never use client flags as a
security boundary — authorization stays server-side (SECURITY.md).
