import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Backend interceptor composition for production builds. Replaces
 * `backend-interceptors.ts` through angular.json `fileReplacements`, so the
 * dev mock backend is not part of the production module graph.
 *
 * Add interceptors that must ship to users here (they run innermost, after
 * auth). Cross-cutting concerns such as errors, i18n, telemetry and auth are
 * already registered in app.config.ts.
 */
export function provideBackendInterceptors(): HttpInterceptorFn[] {
  return [];
}
