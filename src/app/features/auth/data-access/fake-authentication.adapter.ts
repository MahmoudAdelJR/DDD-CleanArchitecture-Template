import { Injectable } from '@angular/core';
import { AppPermissions } from '../../../core/authorization/app-permissions';
import type { AuthUser } from '../../../core/services/auth-session.service';
import { AUTHENTICATION_PORT, SignInFailure } from './authentication.port';
import type { AuthenticatedSession, SignInCredentials } from '../sign-in/sign-in.models';

interface DemoAccount {
  password: string;
  user: AuthUser;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    password: 'Admin123!',
    user: {
      id: '1',
      fullName: 'Ada Admin',
      email: 'admin@demo.local',
      permissions: [AppPermissions.customersRead, AppPermissions.customersWrite],
      roles: ['admin']
    }
  },
  {
    password: 'Reader123!',
    user: {
      id: '2',
      fullName: 'Ray Reader',
      email: 'reader@demo.local',
      permissions: [AppPermissions.customersRead],
      roles: ['user']
    }
  }
];

const DEMO_LATENCY_MS = 400;

@Injectable()
export class FakeAuthenticationAdapter {
  async signIn(credentials: SignInCredentials): Promise<AuthenticatedSession> {
    await new Promise(resolve => setTimeout(resolve, DEMO_LATENCY_MS));

    const email = credentials.email.trim().toLowerCase();
    const account = DEMO_ACCOUNTS.find(
      candidate => candidate.user.email === email && candidate.password === credentials.password
    );

    if (!account) {
      throw new SignInFailure('invalid_credentials', 'Email or password is incorrect.');
    }

    return {
      user: account.user,
      accessToken: `demo-access-token-${account.user.id}`
    };
  }
}

export const provideFakeAuthentication = () => [
  { provide: AUTHENTICATION_PORT, useClass: FakeAuthenticationAdapter }
];
