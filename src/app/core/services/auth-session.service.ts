// core/services/auth-session.service.ts

import { computed, Injectable, signal } from '@angular/core';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  permissions: string[];
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _accessToken = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly accessToken = this._accessToken.asReadonly();

  readonly isAuthenticated = computed(
    () => this._user() !== null && this._accessToken() !== null
  );

  setSession(user: AuthUser, accessToken: string): void {
    this._user.set(user);
    this._accessToken.set(accessToken);
  }

  clearSession(): void {
    this._user.set(null);
    this._accessToken.set(null);
  }

  hasPermission(permission: string): boolean {
    return this.user()?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.user()?.roles.includes(role) ?? false;
  }
}
