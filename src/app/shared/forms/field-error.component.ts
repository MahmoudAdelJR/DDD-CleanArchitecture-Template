import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { ValidationMessageResolver } from './validation-message.resolver';

/**
 * Accessible single-slot field error renderer. Give it a stable `id` and
 * reference it from the control with aria-describedby:
 *
 * ```html
 * <input id="email" aria-describedby="email-errors" />
 * <app-field-error id="email-errors" [control]="form.controls.email" [show]="showEmailError()" />
 * ```
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (messages().length > 0) {
      <span class="field-error">
        @for (message of messages(); track $index) {
          @if (!$first) {
            <br />
          }
          {{ message }}
        }
      </span>
    }
  `
})
export class FieldErrorComponent {
  readonly control = input<AbstractControl | null>(null);
  readonly label = input('');
  /** Visibility gate (touched/submitted logic) owned by the caller. */
  readonly show = input(true);

  private readonly resolver = inject(ValidationMessageResolver);

  protected readonly messages = computed(() =>
    this.show() ? this.resolver.messages(this.control(), this.label()) : []
  );
}
