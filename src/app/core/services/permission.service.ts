import { inject, Injectable } from '@angular/core';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authSession = inject(AuthSessionService);

  hasPermission(permission: string): boolean {
    return this.authSession.hasPermission(permission);
  }

  hasAnyPermission(permissions: readonly string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAllPermissions(permissions: readonly string[]): boolean {
    return permissions.every(permission => this.hasPermission(permission));
  }
}