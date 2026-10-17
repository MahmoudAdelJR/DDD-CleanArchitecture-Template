import type { HttpInterceptorFn } from '@angular/common/http';
import { mockApiInterceptor } from './dev/mock-api.interceptor';

/**
 * Backend interceptor composition (development/demo default).
 *
 * This file is replaced by `backend-interceptors.production.ts` during a
 * production build (see `fileReplacements` in angular.json), so the dev mock
 * backend and its fixtures never reach a release bundle. Add real backend
 * interceptors to the production file instead of here.
 */
export function provideBackendInterceptors(): HttpInterceptorFn[] {
  return [mockApiInterceptor];
}
