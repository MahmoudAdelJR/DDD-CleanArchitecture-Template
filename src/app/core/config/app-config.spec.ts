import {
  APP_CONFIG,
  AppConfig,
  DEFAULT_APP_CONFIG,
  normalizeAppConfig,
  provideAppConfig,
  validateAppConfig,
} from './app-config';

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return { ...DEFAULT_APP_CONFIG, ...overrides };
}

describe('validateAppConfig', () => {
  it('accepts a same-origin path', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: '/api' }))).not.toThrow();
  });

  it('accepts an absolute origin that is trusted', () => {
    expect(() =>
      validateAppConfig(
        config({
          apiBaseUrl: 'https://api.example.com/v1',
          trustedOrigins: ['https://api.example.com'],
        }),
      ),
    ).not.toThrow();
  });

  it('rejects a protocol-relative apiBaseUrl', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: '//evil.example.com' }))).toThrowError(
      /protocol-relative/,
    );
  });

  it('rejects an absolute origin that is not trusted', () => {
    expect(() =>
      validateAppConfig(config({ apiBaseUrl: 'https://api.example.com/v1', trustedOrigins: [] })),
    ).toThrowError(/must be listed in trustedOrigins/);
  });

  it('rejects non-http(s) protocols', () => {
    expect(() =>
      validateAppConfig(
        config({ apiBaseUrl: 'ftp://api.example.com', trustedOrigins: ['ftp://api.example.com'] }),
      ),
    ).toThrowError(/must use http\(s\)/);
  });

  it('rejects credentials embedded in the URL', () => {
    expect(() =>
      validateAppConfig(
        config({
          apiBaseUrl: 'https://user:secret@api.example.com',
          trustedOrigins: ['https://api.example.com'],
        }),
      ),
    ).toThrowError(/must not contain credentials/);
  });

  it('rejects a bare root path (would produce protocol-relative URLs)', () => {
    expect(() => validateAppConfig(config({ apiBaseUrl: '/' }))).toThrowError(/non-empty/);
  });
});

describe('normalizeAppConfig', () => {
  it('trims trailing slashes from apiBaseUrl', () => {
    expect(normalizeAppConfig(config({ apiBaseUrl: '/api/' })).apiBaseUrl).toBe('/api');
    expect(
      normalizeAppConfig(config({ apiBaseUrl: 'https://api.example.com/v1///' })).apiBaseUrl,
    ).toBe('https://api.example.com/v1');
  });

  it('clones array fields so shared defaults cannot be mutated', () => {
    const normalized = normalizeAppConfig(DEFAULT_APP_CONFIG);
    expect(normalized.trustedOrigins).not.toBe(DEFAULT_APP_CONFIG.trustedOrigins);
    expect(normalized.supportedLocales).not.toBe(DEFAULT_APP_CONFIG.supportedLocales);
  });
});

describe('provideAppConfig', () => {
  it('provides the normalized config and validates it', () => {
    const { useValue } = provideAppConfig(config({ apiBaseUrl: '/api/' })) as {
      useValue: AppConfig;
    };
    expect(useValue.apiBaseUrl).toBe('/api');
  });

  it('throws for invalid config so the app fails fast at bootstrap', () => {
    expect(() => provideAppConfig(config({ apiBaseUrl: '//evil.example.com' }))).toThrow();
  });
});

describe('APP_CONFIG token', () => {
  it('is created with a descriptive name', () => {
    expect(APP_CONFIG.toString()).toContain('core.AppConfig');
  });
});
