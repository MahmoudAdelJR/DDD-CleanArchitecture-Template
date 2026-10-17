#!/usr/bin/env node
/**
 * One-time project initializer for teams adopting the template.
 *
 *   npm run init:project -- --name "My Application" [options]
 *
 *   --name <display>        required (prompted if missing) — app title/branding
 *   --package <npm-name>    defaults to kebab-case of --name
 *   --angular-project <n>   defaults to --package (renames angular.json project,
 *                           CI + Docker artifact paths)
 *   --storage-prefix <p>    defaults to --package (namespaces session/language keys)
 *   --version <x.y.z>       consumer app version, default 0.1.0
 *   --api-base-url <url>    optional DEFAULT_APP_CONFIG override
 *   --default-locale <en|fr> optional default locale (syncs index.html lang)
 *   --dry-run               print the exact change manifest, write nothing
 *   --force                 re-run over an already-initialized project
 *
 * Transactional: every rewrite is snapshotted, gates run afterwards
 * (format, architecture, typecheck, lint, unit tests, build), and ANY
 * failure restores the workspace to its exact prior state.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Transaction, WorkspaceError, defaultRunCommand, makeToolRunner } from './workspace.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(join(dirname(MODULE_PATH), '..'));

const OLD_PROJECT = 'DDD-CleanArchitecture-Template';
const OLD_TITLE = 'DDD Clean Architecture Template';
const OLD_SESSION_KEY = 'app.session.v1';
const OLD_LANGUAGE_KEY = 'app.language';
const SENTINEL = 'project.init.json';

function parseArgs(argv) {
  const flags = new Map();
  const booleans = new Set();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new WorkspaceError(`Unexpected argument "${token}". All options are --flags.`);
    }
    const key = token.slice(2);
    if (key === 'dry-run' || key === 'force') {
      booleans.add(key);
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new WorkspaceError(`--${key} requires a value.`);
    }
    flags.set(key, value);
    i++;
  }
  const unknown = [...flags.keys()].filter(
    (k) =>
      ![
        'name',
        'package',
        'angular-project',
        'storage-prefix',
        'version',
        'api-base-url',
        'default-locale',
      ].includes(k),
  );
  if (unknown.length > 0) {
    throw new WorkspaceError(`Unknown option(s): ${unknown.map((u) => `--${u}`).join(', ')}`);
  }
  return { flags, force: booleans.has('force'), dryRun: booleans.has('dry-run') };
}

function kebabSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function derivePlan(flags) {
  const name = (flags.get('name') ?? '').trim();
  if (!name)
    throw new WorkspaceError('--name (display name) is required, e.g. --name "My Application".');
  if (/["'`\\\r\n]/.test(name))
    throw new WorkspaceError('--name must not contain quotes, backslashes or newlines.');

  const pkg = flags.get('package') ?? kebabSlug(name);
  if (!/^[a-z0-9][a-z0-9._~-]*$/.test(pkg)) {
    throw new WorkspaceError(
      `--package "${pkg}" is not a valid npm name (lowercase, e.g. "my-application").`,
    );
  }

  const angularProject = flags.get('angular-project') ?? pkg;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(angularProject)) {
    throw new WorkspaceError(
      `--angular-project "${angularProject}" is not a valid Angular project name.`,
    );
  }

  const storagePrefix = flags.get('storage-prefix') ?? pkg;
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(storagePrefix)) {
    throw new WorkspaceError(
      `--storage-prefix "${storagePrefix}" is invalid (lowercase, no spaces).`,
    );
  }

  const version = flags.get('version') ?? '0.1.0';
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new WorkspaceError(`--version "${version}" is not a valid semver (e.g. 0.1.0).`);
  }

  const defaultLocale = flags.get('default-locale');
  if (defaultLocale !== undefined && !['en', 'fr'].includes(defaultLocale)) {
    throw new WorkspaceError(
      `--default-locale must be "en" or "fr" (the bundled catalogs), got "${defaultLocale}".`,
    );
  }

  const apiBaseUrl = flags.get('api-base-url');
  if (apiBaseUrl !== undefined && (/["'\\\r\n]/.test(apiBaseUrl) || apiBaseUrl.trim() === '')) {
    throw new WorkspaceError('--api-base-url must be a simple non-empty string without quotes.');
  }

  return { name, pkg, angularProject, storagePrefix, version, defaultLocale, apiBaseUrl };
}

function replaceAll(text, find, replace) {
  return { text: text.split(find).join(replace), applied: text.includes(find) };
}

function buildManifest(root, plan) {
  const edits = []; // { rel, get(after) }
  const fileCache = new Map();
  const read = (rel) => {
    if (!fileCache.has(rel)) fileCache.set(rel, readFileSync(join(root, rel), 'utf8'));
    return fileCache.get(rel);
  };

  const pendingOps = new Map(); // rel -> [[find, replace], ...]
  const literal = (rel, ops) => {
    if (!existsSync(join(root, rel))) return;
    pendingOps.set(rel, [...(pendingOps.get(rel) ?? []), ...ops]);
  };

  const resolvedEdits = [];
  const finalize = () => {
    for (const [rel, ops] of pendingOps) {
      const original = read(rel);
      let text = original;
      const applied = [];
      const skipped = [];
      for (const [find, replace] of ops) {
        const result = replaceAll(text, find, replace);
        if (result.applied) {
          text = result.text;
          applied.push(find);
        } else {
          skipped.push(find);
        }
      }
      if (applied.length > 0 && text !== original) {
        resolvedEdits.push({ rel, before: original, after: text, applied, skipped });
      }
    }
    edits.push(...resolvedEdits);
  };

  const jsonEdit = (rel, mutate) => {
    if (!existsSync(join(root, rel))) return;
    const original = read(rel);
    const data = JSON.parse(original);
    const changed = mutate(data);
    if (changed) {
      const after = `${JSON.stringify(data, null, 2)}\n`;
      edits.push({ rel, before: original, after, applied: ['(json fields)'], skipped: [] });
    }
  };

  jsonEdit('package.json', (data) => {
    const changed = data.name !== plan.pkg || data.version !== plan.version;
    data.name = plan.pkg;
    data.version = plan.version;
    return changed;
  });

  jsonEdit('package-lock.json', (data) => {
    if (!data.packages || !data.packages['']) return false;
    const changed =
      data.name !== plan.pkg ||
      data.version !== plan.version ||
      data.packages[''].name !== plan.pkg ||
      data.packages[''].version !== plan.version;
    data.name = plan.pkg;
    data.version = plan.version;
    data.packages[''].name = plan.pkg;
    data.packages[''].version = plan.version;
    return changed;
  });

  literal('angular.json', [[OLD_PROJECT, plan.angularProject]]);
  literal('deploy/Dockerfile', [[OLD_PROJECT, plan.angularProject]]);
  literal('.github/workflows/ci.yml', [[OLD_PROJECT, plan.angularProject]]);
  literal('src/index.html', [[`<title>${OLD_TITLE}</title>`, `<title>${plan.name}</title>`]]);
  literal('README.md', [[`# ${OLD_TITLE}`, `# ${plan.name}`]]);
  literal('src/app/core/i18n/locale-catalog.ts', [
    [`'app.title': 'DDD Template'`, `'app.title': '${plan.name}'`],
    [`'app.title': 'Modèle DDD'`, `'app.title': '${plan.name}'`],
  ]);
  literal('src/app/core/services/auth-session.service.ts', [
    [OLD_SESSION_KEY, `${plan.storagePrefix}.session.v1`],
  ]);
  literal('src/app/core/services/auth-session.service.spec.ts', [
    [OLD_SESSION_KEY, `${plan.storagePrefix}.session.v1`],
  ]);
  literal('src/app/core/i18n/locale.service.ts', [
    [OLD_LANGUAGE_KEY, `${plan.storagePrefix}.language`],
  ]);
  literal('docs/ARCHITECTURE.md', [[OLD_SESSION_KEY, `${plan.storagePrefix}.session.v1`]]);
  literal('docs/recipes/pwa.md', [
    [OLD_SESSION_KEY, `${plan.storagePrefix}.session.v1`],
    [OLD_LANGUAGE_KEY, `${plan.storagePrefix}.language`],
  ]);
  literal('deploy/README.md', [['ddd-template-web:local', `${plan.pkg}-web:local`]]);

  if (plan.apiBaseUrl !== undefined) {
    literal('src/app/core/config/app-config.ts', [
      [`apiBaseUrl: '/api'`, `apiBaseUrl: '${plan.apiBaseUrl}'`],
    ]);
  }
  if (plan.defaultLocale !== undefined) {
    literal('src/app/core/config/app-config.ts', [
      [`defaultLocale: 'en'`, `defaultLocale: '${plan.defaultLocale}'`],
    ]);
    literal('src/index.html', [[`<html lang="en">`, `<html lang="${plan.defaultLocale}">`]]);
  }

  finalize();
  return edits;
}

function printWarnings(log, plan) {
  log('\nDeliberately NOT automated (decide consciously):');
  log('  - LICENSE attribution stays as-is; add your organization notice only if required.');
  log('  - The git remote still points at the template repository.');
  log('  - Branding beyond names: favicon, design tokens (src/styles.scss), nav labels.');
  log('  - Demo content stays in place (in-memory fakes, demo accounts, customers slice).');
  log('  - docs/SECURITY.md contact + your server-side authorization story.');
  log(`\nBoth locale catalogs now show "${plan.name}" as the app title (single name for en/fr).`);
}

export async function runInitializer({
  argv,
  root = DEFAULT_ROOT,
  runCommand = defaultRunCommand,
  log = (message) => console.log(message),
  ask = null,
} = {}) {
  const { flags, force, dryRun } = parseArgs(argv);

  if (!flags.has('name') && ask) {
    flags.set('name', await ask('Application display name: '));
  }
  const plan = derivePlan(flags);

  if (existsSync(join(root, SENTINEL)) && !force) {
    throw new WorkspaceError(
      `${SENTINEL} exists — this workspace was already initialized. Re-run with --force to rebrand over it.`,
    );
  }

  const edits = buildManifest(root, plan);
  const manifest = edits.map(
    (e) =>
      `  ${e.rel}  (${e.applied.length} replacement(s)${e.skipped.length ? `, skipped: ${e.skipped.join(', ')}` : ''})`,
  );

  if (dryRun) {
    log(
      `DRY RUN — no changes will be written. Planned for "${plan.name}" (${plan.pkg}, angular: ${plan.angularProject}):`,
    );
    log(
      manifest.length
        ? manifest.join('\n')
        : '  (nothing to change — workspace already matches the plan)',
    );
    printWarnings(log, plan);
    return { plan, edits, dryRun: true };
  }

  const tx = new Transaction();
  const runTool = makeToolRunner({ root, runCommand });
  try {
    for (const edit of edits) tx.patchFile(join(root, edit.rel), edit.after);
    tx.writeFile(
      join(root, SENTINEL),
      `${JSON.stringify(
        {
          name: plan.name,
          package: plan.pkg,
          angularProject: plan.angularProject,
          storagePrefix: plan.storagePrefix,
          version: plan.version,
          initializedFromTemplateAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );

    const formatTargets = edits
      .map((e) => e.rel)
      .filter((rel) => /\.(ts|json|html|md|mjs|yml|yaml|scss)$/.test(rel));
    if (formatTargets.length > 0) {
      runTool('prettier', ['--write', ...formatTargets]);
    }
    const steps = [
      ['checkArchitecture', [], 'slice wiring integrity'],
      ['tsc', ['--noEmit', '-p', 'tsconfig.app.json'], 'app typecheck'],
      ['tsc', ['--noEmit', '-p', 'tsconfig.spec.json'], 'spec typecheck'],
      ['eslint', ['.'], 'lint + boundaries'],
      ['ng', ['test', '--no-watch', '--browsers=ChromeHeadless'], 'unit tests'],
      ['ng', ['build'], 'production build'],
    ];
    log(`Verifying: ${steps.map((s) => s[2]).join(' → ')}…`);
    for (const [tool, args] of steps) runTool(tool, args);
    tx.commit();
  } catch (error) {
    const problems = tx.rollback();
    throw new WorkspaceError(
      `${error.message}\nWorkspace rolled back.${problems.length ? ` ROLLBACK INCOMPLETE: ${problems.join('; ')}` : ''}`,
    );
  }

  log(
    `Initialized "${plan.name}" (${plan.pkg}) — ${edits.length} file(s) rewritten, all gates green.`,
  );
  log(`Recorded in ${SENTINEL}. Rebrand again with: npm run init:project -- --name ... --force`);
  log('Now: npm start  (and run npm run e2e before your first push).');
  printWarnings(log, plan);
  return { plan, edits, dryRun: false };
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const cli = async () => {
    let ask = null;
    const argv = process.argv.slice(2);
    if (!argv.includes('--name')) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      ask = (question) => rl.question(question);
      ask.close = () => rl.close();
    }
    try {
      const result = await runInitializer({ argv, ask });
      ask?.close?.();
      return result;
    } catch (error) {
      ask?.close?.();
      console.error(`\nInitializer FAILED: ${error.message}`);
      process.exitCode = 1;
    }
  };
  void cli();
}
