import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input
} from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';

@Directive({
  selector: '[appHasPermission]'
})
export class HasPermissionDirective {
  readonly appHasPermission = input.required<string>();

  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly permissionService = inject(PermissionService);

  constructor() {
    effect(() => {
      const permission = this.appHasPermission();
      this.viewContainerRef.clear();

      if (this.permissionService.hasPermission(permission)) {
        this.viewContainerRef.createEmbeddedView(this.templateRef);
      }
    });
  }
}