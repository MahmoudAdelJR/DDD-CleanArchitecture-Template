import { DEFAULT_APP_CONFIG } from './app-config';
import { loadRuntimeAppConfig } from './runtime-app-config';

describe('loadRuntimeAppConfig', () => {
  it('merges a partial runtime file over defaults and bypasses caches', async () => {
    let requestedUrl = '';
    let requestedInit: RequestInit | undefined;
    const fetcher = (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl =
        input instanceof URL ? input.href : typeof input === 'string' ? input : input.url;
      requestedInit = init;
      return Promise.resolve(
        jsonResponse({
          apiBaseUrl: 'https://api.example.com/v1',
          trustedOrigins: ['https://api.example.com'],
        }),
      );
    };

    const config = await loadRuntimeAppConfig(fetcher, 'https://app.example.com/sub/');

    expect(requestedUrl).toBe('https://app.example.com/sub/config/app-config.json');
    expect(requestedInit?.cache).toBe('no-store');
    expect(config).toEqual({
      ...DEFAULT_APP_CONFIG,
      apiBaseUrl: 'https://api.example.com/v1',
      trustedOrigins: ['https://api.example.com'],
    });
  });

  it('uses cloned local defaults when the runtime file is absent', async () => {
    const config = await loadRuntimeAppConfig(
      responseFetcher(new Response(null, { status: 404, statusText: 'Not Found' })),
      'http://localhost:4200/',
    );

    expect(config).toEqual(DEFAULT_APP_CONFIG);
    expect(config.trustedOrigins).not.toBe(DEFAULT_APP_CONFIG.trustedOrigins);
    expect(config.supportedLocales).not.toBe(DEFAULT_APP_CONFIG.supportedLocales);
  });

  it('fails closed when the config endpoint returns a non-404 error', async () => {
    await expectAsync(
      loadRuntimeAppConfig(
        responseFetcher(new Response(null, { status: 503, statusText: 'Unavailable' })),
        'https://app.example.com/',
      ),
    ).toBeRejectedWithError(/503 Unavailable/);
  });

  it('rejects malformed JSON', async () => {
    await expectAsync(
      loadRuntimeAppConfig(
        responseFetcher(new Response('{', { headers: { 'content-type': 'application/json' } })),
        'https://app.example.com/',
      ),
    ).toBeRejectedWithError(/not valid JSON/);
  });

  it('rejects unknown keys so deployment typos cannot pass silently', async () => {
    await expectAsync(
      loadRuntimeAppConfig(jsonFetcher({ apiBaseURL: '/wrong-case' }), 'https://app.example.com/'),
    ).toBeRejectedWithError(/unknown key\(s\): apiBaseURL/);
  });

  it('rejects invalid runtime value types', async () => {
    await expectAsync(
      loadRuntimeAppConfig(
        jsonFetcher({ trustedOrigins: 'https://api.example.com' }),
        'https://app.example.com/',
      ),
    ).toBeRejectedWithError(/trustedOrigins must be a string array/);

    await expectAsync(
      loadRuntimeAppConfig(jsonFetcher({ mockApi: 'true' }), 'https://app.example.com/'),
    ).toBeRejectedWithError(/mockApi must be a boolean/);
  });

  it('validates locale and trusted-origin invariants after merging', async () => {
    await expectAsync(
      loadRuntimeAppConfig(jsonFetcher({ defaultLocale: 'de' }), 'https://app.example.com/'),
    ).toBeRejectedWithError(/defaultLocale must be included/);

    await expectAsync(
      loadRuntimeAppConfig(
        jsonFetcher({ trustedOrigins: ['https://api.example.com/path'] }),
        'https://app.example.com/',
      ),
    ).toBeRejectedWithError(/must be bare origins/);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function responseFetcher(response: Response): () => Promise<Response> {
  return () => Promise.resolve(response);
}

function jsonFetcher(body: unknown): () => Promise<Response> {
  return responseFetcher(jsonResponse(body));
}
