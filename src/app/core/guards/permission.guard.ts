import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from '../services/permission.service';

export function permissionGuard(requiredPermission: string): CanActivateFn {
  return () => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    if (permissionService.hasPermission(requiredPermission)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}