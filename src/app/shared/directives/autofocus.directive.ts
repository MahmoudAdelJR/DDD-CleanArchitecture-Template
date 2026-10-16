import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Focuses the host element once when enabled. Opt out with
 * [appAutofocus]="false" for dialogs or flows with their own focus handling.
 */
@Directive({
  selector: '[appAutofocus]'
})
export class AutofocusDirective {
  readonly appAutofocus = input(true, { alias: 'appAutofocus' });

  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private applied = false;

  constructor() {
    effect(() => {
      if (this.appAutofocus() && !this.applied) {
        this.applied = true;
        queueMicrotask(() => this.elementRef.nativeElement.focus());
      }
    });
  }
}
