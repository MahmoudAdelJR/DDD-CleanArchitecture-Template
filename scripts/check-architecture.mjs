#!/usr/bin/env node
/**
 * Architecture integrity checks that ESLint zones alone cannot guarantee:
 *
 *  1. Every feature folder has a matching cross-feature boundary zone
 *     (exactly one) in eslint.config.mjs.
 *  2. Every feature folder is wired as a lazy route in app.routes.ts
 *     (exactly once, pointing at <feature>.routes) and its routes file exists.
 *  3. No stale zones or dead lazy imports (wiring without a folder).
 *  4. No duplicate zones or duplicate lazy imports.
 *
 * Wired into package.json as `check:architecture`, into CI, and into the
 * generator's verification steps.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(join(dirname(MODULE_PATH), '..'));

export function checkArchitecture({ root = DEFAULT_ROOT } = {}) {
  const errors = [];
  const featuresDir = join(root, 'src', 'app', 'features');
  const eslintPath = join(root, 'eslint.config.mjs');
  const appRoutesPath = join(root, 'src', 'app', 'app.routes.ts');

  if (!existsSync(eslintPath)) errors.push('eslint.config.mjs is missing at the workspace root.');
  if (!existsSync(appRoutesPath))
    errors.push('src/app/app.routes.ts is missing at the workspace root.');
  if (errors.length > 0) return { errors, featureFolders: [] };

  const eslintSource = readFileSync(eslintPath, 'utf8');
  const routesSource = readFileSync(appRoutesPath, 'utf8');

  const featureFolders = existsSync(featuresDir)
    ? readdirSync(featuresDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

  const zoneTargets = [...eslintSource.matchAll(/target:\s*['"]\.\/features\/([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  const routeImports = [
    ...routesSource.matchAll(/import\(\s*['"]\.\/features\/([^/'"]+)\/([^'"]+)['"]\s*\)/g),
  ].map((match) => ({ folder: match[1], file: match[2] }));

  for (const folder of featureFolders) {
    const zoneCount = zoneTargets.filter((target) => target === folder).length;
    if (zoneCount === 0) {
      errors.push(
        `Feature "src/app/features/${folder}" has NO cross-feature boundary zone in eslint.config.mjs. Add one (or re-run scripts/generate.mjs feature).`,
      );
    } else if (zoneCount > 1) {
      errors.push(
        `Feature "${folder}" has ${zoneCount} boundary zones in eslint.config.mjs — keep exactly one.`,
      );
    }

    if (!existsSync(join(featuresDir, folder, `${folder}.routes.ts`))) {
      errors.push(
        `Feature "${folder}" is missing its routes file: src/app/features/${folder}/${folder}.routes.ts.`,
      );
    }

    const imports = routeImports.filter((entry) => entry.folder === folder);
    if (imports.length === 0) {
      errors.push(
        `Feature "${folder}" is not wired into src/app/app.routes.ts as a lazy route. Either register it or remove the folder.`,
      );
    } else if (imports.length > 1) {
      errors.push(
        `Feature "${folder}" is registered ${imports.length} times in app.routes.ts — keep exactly one.`,
      );
    } else if (imports[0].file !== `${folder}.routes`) {
      errors.push(
        `Feature "${folder}" is lazily imported from "${imports[0].file}" — expected "${folder}.routes".`,
      );
    }
  }

  for (const target of zoneTargets) {
    if (!featureFolders.includes(target)) {
      errors.push(
        `eslint.config.mjs has a boundary zone for "features/${target}" but that folder does not exist.`,
      );
    }
  }
  for (const entry of routeImports) {
    if (!featureFolders.includes(entry.folder)) {
      errors.push(`app.routes.ts lazily imports feature "${entry.folder}" which does not exist.`);
    }
  }

  return { errors, featureFolders };
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  const { errors, featureFolders } = checkArchitecture();
  if (errors.length > 0) {
    console.error('Architecture integrity check FAILED:\n');
    for (const error of errors) console.error(`  - ${error}`);
    console.error('\nSee docs/ARCHITECTURE.md for the wiring conventions.');
    process.exitCode = 1;
  } else {
    console.log(
      `Architecture integrity OK: ${featureFolders.length} feature(s) with zones + lazy routes wired.`,
    );
  }
}
