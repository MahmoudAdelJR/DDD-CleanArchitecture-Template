#!/usr/bin/env node
/**
 * Architecture integrity checks that ESLint zones alone cannot guarantee:
 *
 *  1. Every feature folder under src/app/features has a matching
 *     cross-feature boundary zone in eslint.config.mjs.
 *  2. Every registered lazy feature route corresponds to an existing folder
 *     (no dead imports).
 *
 * Wired into package.json as `check:architecture` and into CI.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEATURES_DIR = join(ROOT, 'src', 'app', 'features');
const ESLINT_CONFIG = join(ROOT, 'eslint.config.mjs');
const APP_ROUTES = join(ROOT, 'src', 'app', 'app.routes.ts');

const errors = [];

const featureFolders = existsSync(FEATURES_DIR)
  ? readdirSync(FEATURES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const eslintSource = readFileSync(ESLINT_CONFIG, 'utf8');
const routesSource = readFileSync(APP_ROUTES, 'utf8');

for (const folder of featureFolders) {
  const zonePattern = new RegExp(`target:\\s*'\\./features/${folder}'`);
  if (!zonePattern.test(eslintSource)) {
    errors.push(
      `Feature "src/app/features/${folder}" has NO cross-feature boundary zone in eslint.config.mjs. Add one (or re-run scripts/generate.mjs feature).`
    );
  }

  const routePattern = new RegExp(`features/${folder}/${folder}\\.routes`);
  if (!routePattern.test(routesSource)) {
    errors.push(
      `Feature "${folder}" is not wired into src/app/app.routes.ts as a lazy route. Either register it or remove the folder.`
    );
  }
}

const lazyImportPattern = /import\('\.\/features\/([^/']+)\/([^']+)'\)/g;
for (const match of routesSource.matchAll(lazyImportPattern)) {
  const folder = match[1];
  if (!featureFolders.includes(folder)) {
    errors.push(`app.routes.ts lazily imports feature "${folder}" which does not exist.`);
  }
}

if (errors.length > 0) {
  console.error('Architecture integrity check FAILED:\n');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  console.error('\nSee docs/ARCHITECTURE.md for the wiring conventions.');
  process.exit(1);
}

console.log(
  `Architecture integrity OK: ${featureFolders.length} feature(s) with zones + lazy routes wired.`
);
