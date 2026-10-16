import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Error panel with an optional retry affordance.
 * ```html
 * <app-error-state [message]="msg" (retry)="reload()" />
 * ```
 */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error-state" role="alert">
      <p class="error-state__message">{{ message() }}</p>
      @if (retryLabel()) {
        <button type="button" class="button button--secondary" (click)="retry.emit()">
          {{ retryLabel() }}
        </button>
      }
    </div>
  `,
  styles: `
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      border: 1px solid var(--color-danger);
      background: rgba(179, 38, 30, 0.06);
      border-radius: var(--radius);
      padding: var(--space-6);
      text-align: center;
    }

    .error-state__message {
      margin: 0;
      color: var(--color-danger);
    }
  `
})
export class ErrorStateComponent {
  readonly message = input.required<string>();
  readonly retryLabel = input<string>('');

  readonly retry = output<void>();
}
