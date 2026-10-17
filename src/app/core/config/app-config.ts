import { InjectionToken, Provider } from '@angular/core';

export interface AppConfig {
  /** Base URL of the primary API. Relative URLs are treated as same-origin. */
  apiBaseUrl: string;
  /** Additional absolute origins that may receive credentials and custom headers. */
  trustedOrigins: string[];
  supportedLocales: string[];
  defaultLocale: string;
  /**
   * When true, the dev mock API (src/app/dev) answers trusted `/api` requests
   * from fixtures. Never enable in production builds.
   */
  mockApi?: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: '/api',
  trustedOrigins: [],
  supportedLocales: ['en', 'fr'],
  defaultLocale: 'en',
  mockApi: false,
};

export const APP_CONFIG = new InjectionToken<AppConfig>('core.AppConfig');

/**
 * Returns a normalized copy of the config: `apiBaseUrl` loses any trailing
 * slash (so `${apiBaseUrl}/customers` never becomes `//customers`) and the
 * arrays are cloned so callers cannot mutate shared state.
 */
export function normalizeAppConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    apiBaseUrl: trimTrailingSlashes(config.apiBaseUrl),
    trustedOrigins: [...config.trustedOrigins],
    supportedLocales: [...config.supportedLocales],
  };
}

function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function validateAppConfig(config: AppConfig): void {
  if (typeof config.apiBaseUrl !== 'string' || !config.apiBaseUrl.trim()) {
    throw new Error('AppConfig.apiBaseUrl must be a non-empty string.');
  }

  validateApiBaseUrl(config.apiBaseUrl, config.trustedOrigins);

  if (
    !Array.isArray(config.supportedLocales) ||
    config.supportedLocales.length === 0 ||
    config.supportedLocales.some((locale) => typeof locale !== 'string' || !locale.trim())
  ) {
    throw new Error('AppConfig.supportedLocales must be a non-empty string array.');
  }

  if (typeof config.defaultLocale !== 'string') {
    throw new Error('AppConfig.defaultLocale must be a string.');
  }

  if (!config.supportedLocales.includes(config.defaultLocale)) {
    throw new Error('AppConfig.defaultLocale must be included in supportedLocales.');
  }

  if (!Array.isArray(config.trustedOrigins)) {
    throw new Error('AppConfig.trustedOrigins must be a string array.');
  }

  if (config.mockApi !== undefined && typeof config.mockApi !== 'boolean') {
    throw new Error('AppConfig.mockApi must be a boolean when provided.');
  }

  for (const origin of config.trustedOrigins) {
    if (typeof origin !== 'string') {
      throw new Error('AppConfig.trustedOrigins must be a string array.');
    }
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
        `AppConfig.trustedOrigins entries must be bare origins (e.g. "https://api.example.com"), got "${origin}".`,
      );
    }
  }
}

/**
 * `apiBaseUrl` is either a same-origin path (`/api`) or an absolute http(s)
 * URL. An absolute URL must be an origin listed in `trustedOrigins`,
 * otherwise every request would be credential-free by design.
 */
function validateApiBaseUrl(apiBaseUrl: string, trustedOrigins: string[]): void {
  const value = trimTrailingSlashes(apiBaseUrl);

  if (!value) {
    throw new Error(
      'AppConfig.apiBaseUrl must be a non-empty same-origin path or absolute http(s) URL.',
    );
  }

  if (value.startsWith('//')) {
    throw new Error('AppConfig.apiBaseUrl must not be protocol-relative.');
  }

  if (value.startsWith('/')) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `AppConfig.apiBaseUrl must be a same-origin path or absolute http(s) URL, got "${apiBaseUrl}".`,
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`AppConfig.apiBaseUrl must use http(s): "${apiBaseUrl}".`);
  }

  if (parsed.username || parsed.password) {
    throw new Error('AppConfig.apiBaseUrl must not contain credentials.');
  }

  if (!trustedOrigins.includes(parsed.origin)) {
    throw new Error(
      `AppConfig.apiBaseUrl origin "${parsed.origin}" must be listed in trustedOrigins.`,
    );
  }
}

export function provideAppConfig(config: AppConfig): Provider {
  const normalized = normalizeAppConfig(config);
  validateAppConfig(normalized);
  return { provide: APP_CONFIG, useValue: normalized };
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
