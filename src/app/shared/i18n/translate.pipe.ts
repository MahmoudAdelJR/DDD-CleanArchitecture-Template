import { inject, Pipe, PipeTransform } from '@angular/core';
import { TRANSLATION } from './translation.port';

/**
 * Impure so templates refresh when the locale signal changes. Dictionary
 * lookups are plain property reads, making per-change-detection cost trivial.
 */
@Pipe({
  name: 'tr',
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly translation = inject(TRANSLATION);

  transform(key: string, params?: Record<string, string | number>, fallback?: string): string {
    return this.translation.translate(key, params, fallback);
  }
}
