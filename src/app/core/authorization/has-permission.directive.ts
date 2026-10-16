import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { PermissionService } from '../services/permission.service';

/**
 * Structural directive that renders its view only when the session grants the
 * required permission(s). Lives in core/authorization because it depends on
 * the authorization capability — shared must stay free of core imports.
 *
 * ```html
 * <a *appHasPermission="permission">Manage</a>
 * <a *appHasPermission="[readA, readB]">Requires all</a>
 * <span *appHasPermission="permission; else deniedRef">Allowed</span>
 * <ng-template #deniedRef>Denied</ng-template>
 * ```
 *
 * UX control only: the server must still authorize every operation.
 */
@Directive({
  selector: '[appHasPermission]',
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);

  /** A single permission, or a list that all must be granted. */
  readonly appHasPermission = input<string | readonly string[]>();

  /** Set to true to require only one of a list. */
  readonly anyOf = input(false);

  readonly appHasPermissionElse = input<TemplateRef<unknown> | null>(null);

  private lastGranted: boolean | null = null;

  constructor() {
    effect(() => {
      const granted = this.evaluate();
      const elseTemplate = this.appHasPermissionElse();

      // Preserve the embedded view (and its component state) while the
      // outcome is unchanged; only toggle when it flips.
      if (granted === this.lastGranted) {
        return;
      }

      this.lastGranted = granted;
      this.viewContainer.clear();

      if (granted) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else if (elseTemplate) {
        this.viewContainer.createEmbeddedView(elseTemplate);
      }
    });
  }

  private evaluate(): boolean {
    const required = this.appHasPermission();
    if (required === undefined) {
      return false;
    }

    if (typeof required === 'string') {
      return this.permissions.hasPermission(required);
    }

    return this.anyOf()
      ? this.permissions.hasAnyPermission(required)
      : this.permissions.hasAllPermissions(required);
  }
}
