import { AppConfig, DEFAULT_APP_CONFIG, validateAppConfig } from './app-config';

export const RUNTIME_APP_CONFIG_PATH = 'config/app-config.json';

type RuntimeConfigKey = keyof AppConfig;
type RuntimeAppConfig = Partial<AppConfig>;

const ALLOWED_KEYS = new Set<RuntimeConfigKey>([
  'apiBaseUrl',
  'trustedOrigins',
  'supportedLocales',
  'defaultLocale',
  'mockApi',
]);

export type RuntimeConfigFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function loadRuntimeAppConfig(
  fetcher: RuntimeConfigFetcher = fetch,
  baseUri = document.baseURI,
): Promise<AppConfig> {
  const url = new URL(RUNTIME_APP_CONFIG_PATH, baseUri);
  const response = await fetcher(url, { cache: 'no-store' });

  if (response.status === 404) {
    return mergeWithDefaults({});
  }
  if (!response.ok) {
    throw new Error(`Runtime AppConfig request failed: ${response.status} ${response.statusText}`);
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error('Runtime AppConfig is not valid JSON.');
  }

  return mergeWithDefaults(parseRuntimeConfig(value));
}

function parseRuntimeConfig(value: unknown): RuntimeAppConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Runtime AppConfig must be a JSON object.');
  }

  const config = value as Record<string, unknown>;
  const unknownKeys = Object.keys(config).filter(
    (key) => !ALLOWED_KEYS.has(key as RuntimeConfigKey),
  );
  if (unknownKeys.length > 0) {
    throw new Error(`Runtime AppConfig contains unknown key(s): ${unknownKeys.join(', ')}.`);
  }

  return config;
}

function mergeWithDefaults(runtime: RuntimeAppConfig): AppConfig {
  const merged = {
    ...DEFAULT_APP_CONFIG,
    ...runtime,
  };
  validateAppConfig(merged);

  return {
    ...merged,
    trustedOrigins: [...merged.trustedOrigins],
    supportedLocales: [...merged.supportedLocales],
  };
}
