// core/services/auth-session.service.ts

import { Injectable, signal } from '@angular/core';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  permissions: string[];
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  readonly user = signal<AuthUser | null>(null);
  readonly accessToken = signal<string | null>(null);

  readonly isAuthenticated = signal(false);

  setSession(user: AuthUser, accessToken: string): void {
    this.user.set(user);
    this.accessToken.set(accessToken);
    this.isAuthenticated.set(true);
  }

  clearSession(): void {
    this.user.set(null);
    this.accessToken.set(null);
    this.isAuthenticated.set(false);
  }

  hasPermission(permission: string): boolean {
    return this.user()?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.user()?.roles.includes(role) ?? false;
  }
}