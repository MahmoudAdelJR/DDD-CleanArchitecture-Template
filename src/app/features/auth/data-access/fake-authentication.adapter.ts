import { Injectable } from '@angular/core';
import { AppPermissions } from '../../../core/authorization/app-permissions';
import type { SessionPayload } from '../../../core/auth/session.model';
import { SessionRefreshPort } from '../../../core/auth/session-refresh.port';
import { AUTHENTICATION_PORT, SignInFailure } from './authentication.port';
import type { AuthenticatedSession, SignInCredentials } from '../sign-in/sign-in.models';

interface DemoAccount {
  password: string;
  user: SessionPayload['user'];
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
const DEMO_SESSION_MS = 15 * 60 * 1000;

@Injectable()
export class FakeAuthenticationAdapter implements SessionRefreshPort {
  async signIn(credentials: SignInCredentials): Promise<AuthenticatedSession> {
    await this.simulateLatency();

    const email = credentials.email.trim().toLowerCase();
    const account = DEMO_ACCOUNTS.find(
      candidate => candidate.user.email === email && candidate.password === credentials.password
    );

    if (!account) {
      throw new SignInFailure('invalid_credentials', 'Email or password is incorrect.');
    }

    return this.createSession(account.user);
  }

  async refresh(refreshToken: string): Promise<SessionPayload> {
    await this.simulateLatency();

    const userId = refreshToken.replace('demo-refresh-', '');
    const account = DEMO_ACCOUNTS.find(candidate => candidate.user.id === userId);

    if (!account) {
      throw new SignInFailure('invalid_grant', 'Your session has expired. Please sign in again.');
    }

    return this.createSession(account.user);
  }

  private createSession(user: SessionPayload['user']): SessionPayload {
    return {
      user,
      accessToken: `demo-access-token-${user.id}-${Date.now()}`,
      refreshToken: `demo-refresh-${user.id}`,
      expiresAt: Date.now() + DEMO_SESSION_MS
    };
  }

  private simulateLatency(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, DEMO_LATENCY_MS));
  }
}
