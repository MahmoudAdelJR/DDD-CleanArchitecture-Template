import { InjectionToken } from '@angular/core';
import type { AuthenticatedSession, SignInCredentials } from '../sign-in/sign-in.models';

export class SignInFailure extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'SignInFailure';
  }
}

export interface AuthenticationPort {
  signIn(credentials: SignInCredentials): Promise<AuthenticatedSession>;
}

export const AUTHENTICATION_PORT = new InjectionToken<AuthenticationPort>(
  'auth.AuthenticationPort'
);
