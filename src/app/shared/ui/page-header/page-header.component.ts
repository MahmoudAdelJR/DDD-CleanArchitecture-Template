import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Consistent page title row with an optional actions/description slot.
 * ```html
 * <app-page-header [title]="title">
 *   <button class="button">Create</button>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="page-header__titles">
        <h1>{{ title() }}</h1>
        @if (description()) {
          <p class="muted">{{ description() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    .page-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
      flex-wrap: wrap;
    }

    h1 {
      margin: 0;
    }

    .page-header__titles {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
  `
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
