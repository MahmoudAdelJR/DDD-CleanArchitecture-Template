import { InjectionToken, Provider } from '@angular/core';

export interface AppConfig {
  /** Base URL of the primary API. Relative URLs are treated as same-origin. */
  apiBaseUrl: string;
  /** Additional absolute origins that may receive credentials and custom headers. */
  trustedOrigins: string[];
  supportedLocales: string[];
  defaultLocale: string;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  trustedOrigins: [],
  supportedLocales: ['en', 'fr'],
  defaultLocale: 'en'
};

export const APP_CONFIG = new InjectionToken<AppConfig>('core.AppConfig');

export function validateAppConfig(config: AppConfig): void {
  if (!config.apiBaseUrl) {
    throw new Error('AppConfig.apiBaseUrl must be a non-empty string.');
  }

  if (!config.supportedLocales.includes(config.defaultLocale)) {
    throw new Error('AppConfig.defaultLocale must be included in supportedLocales.');
  }

  for (const origin of config.trustedOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`AppConfig.trustedOrigins contains an invalid URL: "${origin}".`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`AppConfig.trustedOrigins must use http(s): "${origin}".`);
    }

    if (parsed.origin !== origin) {
      throw new Error(
        `AppConfig.trustedOrigins entries must be bare origins (e.g. "https://api.example.com"), got "${origin}".`
      );
    }
  }
}

export function provideAppConfig(config: AppConfig): Provider {
  validateAppConfig(config);
  return { provide: APP_CONFIG, useValue: config };
}

/**
 * A request may receive credentials and custom headers only when it targets
 * the application origin or an explicitly configured trusted origin.
 */
export function isTrustedApiUrl(url: string, config: AppConfig): boolean {
  try {
    const page = new URL(document.baseURI, window.location.href);
    const target = new URL(url, page);
    if (target.origin === page.origin) {
      return true;
    }
    return config.trustedOrigins.includes(target.origin);
  } catch {
    return false;
  }
}
