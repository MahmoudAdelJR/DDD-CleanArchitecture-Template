import { inject, Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { TRANSLATION, TranslationPort } from '../i18n/translation.port';

const identityTranslation: TranslationPort = {
  locale: () => 'en',
  supportedLocales: () => ['en'],
  translate: (key, _params, fallback) => fallback ?? key,
  setLocale: () => {},
};

/**
 * Turns Angular `ValidationErrors` into localized, user-presentable messages.
 * 'server' errors carry the string[] from applyServerValidationErrors().
 * Translation is optional so feature specs work without the i18n providers.
 */
@Injectable({ providedIn: 'root' })
export class ValidationMessageResolver {
  private readonly translation = inject(TRANSLATION, { optional: true }) ?? identityTranslation;

  messages(control: AbstractControl | null, label = ''): string[] {
    const errors = control?.errors;
    if (!errors || control?.valid) {
      return [];
    }

    return this.describe(errors, label);
  }

  describe(errors: ValidationErrors, label = ''): string[] {
    const out: string[] = [];

    for (const [key, value] of Object.entries(errors)) {
      switch (key) {
        case 'required':
          out.push(this.translation.translate('validation.required', { label }));
          break;
        case 'requiredTrimmed':
          out.push(this.translation.translate('validation.requiredTrimmed', { label }));
          break;
        case 'email':
          out.push(this.translation.translate('validation.email'));
          break;
        case 'minlength': {
          const actual = value as { requiredLength: number };
          out.push(
            this.translation.translate('validation.minlength', { min: actual.requiredLength }),
          );
          break;
        }
        case 'maxlength': {
          const actual = value as { requiredLength: number };
          out.push(
            this.translation.translate('validation.maxlength', { max: actual.requiredLength }),
          );
          break;
        }
        case 'mustMatch':
          out.push(this.translation.translate('validation.mustMatch'));
          break;
        case 'invalidDateRange':
          out.push(this.translation.translate('validation.invalidDateRange'));
          break;
        case 'server': {
          const messages = Array.isArray(value) ? (value as string[]) : [String(value)];
          out.push(...messages);
          break;
        }
        default:
          out.push(this.translation.translate('validation.unknown'));
      }
    }

    return out;
  }
}
