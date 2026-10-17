# Recipe: Configure one build per environment

The application fetches `config/app-config.json` before Angular bootstraps.
This keeps environment-specific values outside the compiled JavaScript, so the
same immutable build can move from staging to production.

## Configuration shape

Every property is optional. Missing properties use `DEFAULT_APP_CONFIG` from
`src/app/core/config/app-config.ts`:

```json
{
  "apiBaseUrl": "https://api.example.com/v1",
  "trustedOrigins": ["https://api.example.com"],
  "supportedLocales": ["en", "fr"],
  "defaultLocale": "en",
  "mockApi": false
}
```

Unknown properties and invalid values stop application startup. A missing file
(`404`) deliberately falls back to defaults; other HTTP failures and malformed
JSON fail closed. The request uses `cache: "no-store"`.

## Static hosting

Replace `config/app-config.json` as a deployment step after building. Serve it
with `Cache-Control: no-cache, no-store, must-revalidate`; do not fingerprint
the filename. The checked-in `public/config/app-config.json` is `{}`, so local
development and hosts without a deployment transform use the safe defaults.

## nginx container

The reference image in `deploy/` generates the file at container startup:

```bash
docker build -f deploy/Dockerfile -t my-app .
docker run --rm -p 8080:8080 \
  -e APP_API_BASE_URL=https://api.example.com/v1 \
  -e 'APP_TRUSTED_ORIGINS=["https://api.example.com"]' \
  my-app
```

See `deploy/README.md` for every environment variable and its default.

## Security boundary

Runtime config is public browser input, not a secret store. Never put API keys,
client secrets, tokens, connection strings, or private endpoints in it.
`trustedOrigins` controls where bearer tokens may be attached, so review those
values as security-sensitive deployment policy even though they are public.
