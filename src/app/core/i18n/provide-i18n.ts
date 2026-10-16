import { LOCALE_ID, Provider, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { TRANSLATION } from '../../shared/i18n/translation.port';
import { LocaleService } from './locale.service';

// Angular locale data for the bundled demo locales. Register more here or
// tree-shake this file if a deployment ships a single language.
registerLocaleData(localeFr, 'fr');

/**
 * Wires the platform i18n adapters to the shared TranslationPort and makes
 * LOCALE_ID follow the locale resolved at bootstrap (persisted preference).
 * Runtime switching re-renders app pipes/components that read the locale
 * signal; built-in Angular pipes keep the bootstrap value until reload.
 */
export function provideCoreI18n(): Provider[] {
  return [
    LocaleService,
    { provide: TRANSLATION, useExisting: LocaleService },
    { provide: LOCALE_ID, useFactory: () => inject(LocaleService).locale() },
  ];
}
