import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter
} from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthSessionService } from '../services/auth-session.service';
import { STORAGE } from '../storage/storage.port';
import { MemoryStorage } from '../testing/memory-storage';

describe('authGuard', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideZonelessChangeDetection(),
        { provide: STORAGE, useClass: MemoryStorage }
      ]
    });
    router = TestBed.inject(Router);
  });

  function activate(url: string): MaybeAsync<GuardResult> {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(route, state));
  }

  it('allows access when authenticated', () => {
    const session = TestBed.inject(AuthSessionService);
    session.setSession({
      user: { id: '1', fullName: 'Test', email: 'test@example.com', permissions: [], roles: [] },
      accessToken: 'token',
      expiresAt: null
    });

    expect(activate('/customers')).toBe(true);
  });

  it('redirects to login with a return url when unauthenticated', () => {
    const result = activate('/customers/5');

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fcustomers%2F5');
  });

  it('redirects to login without a return url for the root route', () => {
    const result = activate('/');

    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });
});
