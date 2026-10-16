import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TRANSLATION } from '../../shared/i18n/translation.port';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';

/**
 * Runtime language switcher. Persists via LocaleService (through the port)
 * and updates the document lang/dir plus all TRANSLATION-driven UI.
 */
@Component({
  selector: 'app-locale-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <label class="visually-hidden" for="locale-select">{{ 'nav.language' | tr }}</label>
    <select id="locale-select" class="locale-switcher" (change)="change($event)">
      @for (code of translation.supportedLocales(); track code) {
        <option [value]="code" [selected]="code === translation.locale()">
          {{ 'locale.' + code | tr }}
        </option>
      }
    </select>
  `,
  styles: `
    .locale-switcher {
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      font-size: 0.9rem;
    }
  `,
})
export class LocaleSwitcherComponent {
  protected readonly translation = inject(TRANSLATION);

  protected change(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.translation.setLocale(value);
  }
}
