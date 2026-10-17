/**
 * Integration tests for scripts/init-project.mjs.
 *
 * Run with: npm run test:generator (both suites) or directly:
 *   node --test scripts/init-project.integration.test.mjs
 *
 * All scenarios use throwaway fixture workspaces under os.tmpdir().
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInitializer } from './init-project.mjs';

const TEMPLATE_FILES = {
  'package.json': JSON.stringify(
    { name: 'ddd-clean-architecture-template', version: '1.1.0', scripts: { build: 'ng build' } },
    null,
    2,
  ),
  'package-lock.json': JSON.stringify(
    {
      name: 'ddd-clean-architecture-template',
      version: '1.1.0',
      lockfileVersion: 3,
      packages: { '': { name: 'ddd-clean-architecture-template', version: '1.1.0' } },
    },
    null,
    2,
  ),
  'angular.json':
    '{"projects":{"DDD-CleanArchitecture-Template":{"architect":{"serve":{"configurations":{"production":{"buildTarget":"DDD-CleanArchitecture-Template:build:production"}}}}}}}',
  'deploy/Dockerfile':
    'COPY --from=build /app/dist/DDD-CleanArchitecture-Template/browser /usr/share/nginx/html\n',
  '.github/workflows/ci.yml': 'path: dist/DDD-CleanArchitecture-Template/browser\n',
  'src/index.html':
    '<!doctype html>\n<html lang="en">\n  <head>\n    <title>DDD Clean Architecture Template</title>\n  </head>\n</html>\n',
  'README.md': '# DDD Clean Architecture Template\n\nAn Angular 20 vertical-slice template.\n',
  'src/app/core/i18n/locale-catalog.ts':
    "const en = { 'app.title': 'DDD Template' };\nconst fr = { 'app.title': 'Modèle DDD' };\n",
  'src/app/core/services/auth-session.service.ts':
    "const SESSION_STORAGE_KEY = 'app.session.v1';\n",
  'src/app/core/services/auth-session.service.spec.ts':
    "expect(key).toBe('app.session.v1');\nexpect(other).toBe('app.session.v1');\n",
  'src/app/core/i18n/locale.service.ts': "export const LANGUAGE_STORAGE_KEY = 'app.language';\n",
  'docs/ARCHITECTURE.md': '- persisted to the STORAGE port (`app.session.v1`) and restored\n',
  'docs/recipes/pwa.md': 'keys app.session.v1 and app.language matter for cache\n',
  'deploy/README.md': 'docker build -t ddd-template-web:local .\n',
  'src/app/core/config/app-config.ts': "apiBaseUrl: '/api',\ndefaultLocale: 'en',\n",
  'public/config/app-config.json': '{}\n',
  'src/app/app.routes.ts': 'export const routes = [\n  // gen:app-route — marker\n];\n',
  'eslint.config.mjs': 'export default [{ rules: {} }]; // gen:feature-zones — marker\n',
};

const cleanupRoots = [];

function initFixture() {
  const root = mkdtempSync(join(tmpdir(), 'init test '));
  cleanupRoots.push(root);
  for (const [rel, content] of Object.entries(TEMPLATE_FILES)) {
    const target = join(root, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return root;
}

function fakeRunner(failOnTool = null) {
  const calls = [];
  return {
    calls,
    runCommand: (script, args) => {
      const tool = script.split(/[\\/]/).pop();
      calls.push([tool, args]);
      if (failOnTool && tool === failOnTool)
        return { status: 1, stdout: 'controlled failure', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
  };
}

function quietInit(root, runner, argv) {
  return runInitializer({ argv, root, runCommand: runner.runCommand, log: () => {} });
}

function read(root, rel) {
  return readFileSync(join(root, rel), 'utf8');
}

after(() => {
  for (const root of cleanupRoots) rmSync(root, { recursive: true, force: true });
});

describe('init:project success', () => {
  test('renames package, angular project, CI, Docker, titles, storage keys, docs', async () => {
    const root = initFixture();
    const runner = fakeRunner();

    const result = await quietInit(root, runner, ['--name', 'Acme Portal']);

    assert.equal(result.dryRun, false);
    assert.equal(JSON.parse(read(root, 'package.json')).name, 'acme-portal');
    assert.equal(JSON.parse(read(root, 'package.json')).version, '0.1.0');
    const lock = JSON.parse(read(root, 'package-lock.json'));
    assert.equal(lock.name, 'acme-portal');
    assert.equal(lock.packages[''].version, '0.1.0');
    assert.ok(!read(root, 'angular.json').includes('DDD-CleanArchitecture-Template'));
    assert.ok(read(root, 'angular.json').includes('acme-portal'));
    assert.ok(read(root, 'deploy/Dockerfile').includes('/app/dist/acme-portal/browser'));
    assert.ok(read(root, '.github/workflows/ci.yml').includes('dist/acme-portal/browser'));
    assert.ok(read(root, 'src/index.html').includes('<title>Acme Portal</title>'));
    assert.ok(read(root, 'README.md').startsWith('# Acme Portal'));
    assert.ok(!read(root, 'src/app/core/i18n/locale-catalog.ts').includes('DDD Template'));
    assert.ok(
      read(root, 'src/app/core/i18n/locale-catalog.ts').includes("'app.title': 'Acme Portal'"),
    );
    assert.ok(
      read(root, 'src/app/core/services/auth-session.service.ts').includes(
        'acme-portal.session.v1',
      ),
    );
    assert.equal(
      (
        read(root, 'src/app/core/services/auth-session.service.spec.ts').match(
          /acme-portal\.session\.v1/g,
        ) ?? []
      ).length,
      2,
    );
    assert.ok(read(root, 'src/app/core/i18n/locale.service.ts').includes('acme-portal.language'));
    assert.ok(read(root, 'docs/ARCHITECTURE.md').includes('acme-portal.session.v1'));
    assert.ok(!read(root, 'docs/recipes/pwa.md').includes('app.session.v1'));
    assert.ok(read(root, 'deploy/README.md').includes('acme-portal-web:local'));

    assert.ok(existsSync(join(root, 'project.init.json')));
    const sentinel = JSON.parse(read(root, 'project.init.json'));
    assert.equal(sentinel.name, 'Acme Portal');
    assert.equal(sentinel.angularProject, 'acme-portal');

    assert.deepEqual(
      runner.calls.map(([tool]) => tool),
      ['prettier.cjs', 'check-architecture.mjs', 'tsc', 'tsc', 'eslint.js', 'ng.js', 'ng.js'],
    );
  });

  test('explicit options override derivations', async () => {
    const root = initFixture();
    await quietInit(root, fakeRunner(), [
      '--name',
      'Acme Portal',
      '--package',
      'acme-web',
      '--angular-project',
      'acmeNg',
      '--api-base-url',
      'https://api.acme.test',
      '--default-locale',
      'fr',
      '--version',
      '2.0.0',
    ]);

    assert.equal(JSON.parse(read(root, 'package.json')).name, 'acme-web');
    assert.equal(JSON.parse(read(root, 'package.json')).version, '2.0.0');
    assert.ok(read(root, 'angular.json').includes('acmeNg'));
    const runtimeConfig = JSON.parse(read(root, 'public/config/app-config.json'));
    assert.equal(runtimeConfig.apiBaseUrl, 'https://api.acme.test');
    assert.equal(runtimeConfig.defaultLocale, 'fr');
    assert.ok(read(root, 'src/app/core/config/app-config.ts').includes("apiBaseUrl: '/api'"));
    assert.ok(read(root, 'src/index.html').includes('<html lang="fr">'));
  });
});

describe('init:project dry run + re-runs', () => {
  test('--dry-run writes nothing and reports the manifest', async () => {
    const root = initFixture();
    const before = read(root, 'package.json');
    const logLines = [];
    const result = await runInitializer({
      argv: ['--name', 'Acme Portal', '--dry-run'],
      root,
      runCommand: fakeRunner().runCommand,
      log: (m) => logLines.push(m),
    });

    assert.equal(result.dryRun, true);
    assert.equal(read(root, 'package.json'), before);
    assert.ok(!existsSync(join(root, 'project.init.json')));
    assert.ok(logLines.some((l) => l.includes('DRY RUN')));
  });

  test('refuses a second run without --force; --force is a no-op re-run', async () => {
    const root = initFixture();
    await quietInit(root, fakeRunner(), ['--name', 'Acme Portal']);

    await assert.rejects(
      () => quietInit(root, fakeRunner(), ['--name', 'Other Name']),
      /already initialized/u,
    );
    assert.equal(JSON.parse(read(root, 'package.json')).name, 'acme-portal');

    const result = await quietInit(root, fakeRunner(), ['--name', 'Acme Portal', '--force']);
    assert.equal(result.edits.length, 0); // literals already renamed → nothing left to do
    assert.equal(JSON.parse(read(root, 'package.json')).name, 'acme-portal');
  });
});

describe('init:project rollback + validation', () => {
  test('verification failure restores every file and removes the sentinel', async () => {
    const root = initFixture();
    const before = Object.fromEntries(
      Object.keys(TEMPLATE_FILES).map((rel) => [rel, read(root, rel)]),
    );

    await assert.rejects(
      () => quietInit(root, fakeRunner('eslint.js'), ['--name', 'Acme Portal']),
      /Verification step FAILED/u,
    );

    for (const [rel, content] of Object.entries(before)) {
      assert.equal(read(root, rel), content, `${rel} restored`);
    }
    assert.ok(!existsSync(join(root, 'project.init.json')));
  });

  test('invalid names, locales, unknown flags, missing name are rejected', async () => {
    const root = initFixture();
    const runner = fakeRunner();
    await assert.rejects(
      () => quietInit(root, runner, ['--name', 'A', '--package', 'UPPER']),
      /valid npm name/u,
    );
    await assert.rejects(
      () => quietInit(root, runner, ['--name', 'A', '--default-locale', 'de']),
      /"en" or "fr"/u,
    );
    await assert.rejects(
      () => quietInit(root, runner, ['--name', 'A', '--turbo', 'x']),
      /Unknown option/u,
    );
    await assert.rejects(
      () => quietInit(root, runner, ['--name', 'A', '--turbo']),
      /requires a value/u,
    );
    await assert.rejects(
      () => quietInit(root, runner, ['--name', 'A', '--version', '1.x']),
      /not a valid semver/u,
    );
    await assert.rejects(() => quietInit(root, runner, []), /required/u);
    assert.equal(runner.calls.length, 0, 'no tool ran for rejected inputs');
  });
});
