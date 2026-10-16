import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSessionService } from '../../../core/services/auth-session.service';
import {
  AUTHENTICATION_PORT,
  AuthenticationPort,
  SignInFailure
} from '../data-access/authentication.port';
import type { AuthenticatedSession, SignInCredentials } from './sign-in.models';
import { SignInStore } from './sign-in.store';
import { SignInUseCase } from './sign-in.use-case';

const validSession: AuthenticatedSession = {
  user: {
    id: '1',
    fullName: 'Ada Admin',
    email: 'admin@demo.local',
    permissions: ['customers.read', 'customers.write'],
    roles: ['admin']
  },
  accessToken: 'test-token'
};

function createPort(overrides: Partial<AuthenticationPort> = {}): AuthenticationPort {
  return {
    signIn: (credentials: SignInCredentials) =>
      credentials.email === 'admin@demo.local' && credentials.password === 'Admin123!'
        ? Promise.resolve(validSession)
        : Promise.reject(new SignInFailure('invalid_credentials', 'Email or password is incorrect.')),
    ...overrides
  };
}

describe('SignInStore', () => {
  function setup(port: AuthenticationPort = createPort()): { store: SignInStore; session: AuthSessionService } {
    TestBed.configureTestingModule({
      providers: [
        SignInStore,
        SignInUseCase,
        { provide: AUTHENTICATION_PORT, useValue: port },
        provideZonelessChangeDetection()
      ]
    });

    return { store: TestBed.inject(SignInStore), session: TestBed.inject(AuthSessionService) };
  }

  it('establishes a session on successful sign-in', async () => {
    const { store, session } = setup();

    const result = await store.submit({ email: 'admin@demo.local', password: 'Admin123!' });

    expect(result).toBeTrue();
    expect(store.status()).toBe('success');
    expect(session.isAuthenticated()).toBeTrue();
    expect(session.accessToken()).toBe('test-token');
  });

  it('reports a safe error message on failed sign-in', async () => {
    const { store, session } = setup();

    const result = await store.submit({ email: 'admin@demo.local', password: 'wrong' });

    expect(result).toBeFalse();
    expect(store.status()).toBe('failure');
    expect(store.errorMessage()).toBe('Email or password is incorrect.');
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('reports a generic error for unexpected failures', async () => {
    const { store } = setup({
      signIn: () => Promise.reject(new Error('boom'))
    });

    const result = await store.submit({ email: 'x@y.z', password: 'p' });

    expect(result).toBeFalse();
    expect(store.errorMessage()).toBe('Something went wrong. Please try again.');
  });
});
