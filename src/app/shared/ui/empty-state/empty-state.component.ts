import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Friendly placeholder for "no results" states. Project actions after the
 * message if the user can do something about the emptiness.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status">
      <p class="empty-state__message">{{ message() }}</p>
      <div class="empty-state__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .empty-state {
      text-align: center;
      padding: var(--space-6);
      color: var(--color-text-muted);
    }

    .empty-state__message {
      margin: 0 0 var(--space-3);
    }

    .empty-state__actions:not(:empty) {
      display: flex;
      justify-content: center;
      gap: var(--space-2);
    }
  `,
})
export class EmptyStateComponent {
  readonly message = input.required<string>();
}
