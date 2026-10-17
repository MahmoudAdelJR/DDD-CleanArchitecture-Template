#!/usr/bin/env node
/**
 * Production bundle guard.
 *
 * Fails when demo-only artifacts (fake credentials, fake tokens, or mock
 * fixtures) are found in the built output. This is the regression gate behind
 * the angular.json `fileReplacements` that swap the demo providers for real
 * ones in production builds: if someone re-imports a fake adapter into the
 * production graph, this check catches it even though the app still compiles.
 *
 * Usage: node scripts/check-production-bundle.mjs [distDir]
 *   distDir defaults to `dist` (run `npm run build` first).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST_DIR = resolve(process.argv[2] ?? 'dist');

/** String literals that only exist in demo/dev sources. */
const FORBIDDEN_MARKERS = [
  { marker: 'Admin123!', reason: 'demo admin password' },
  { marker: 'Reader123!', reason: 'demo reader password' },
  { marker: 'admin@demo.local', reason: 'demo admin account' },
  { marker: 'reader@demo.local', reason: 'demo reader account' },
  { marker: 'demo-access-token', reason: 'fake access token prefix' },
  { marker: 'demo-refresh-', reason: 'fake refresh token prefix' },
  { marker: 'Acme Industries', reason: 'demo customer fixture' },
];

const SCANNED_EXTENSIONS = /\.(js|mjs|css|html|json|txt)$/i;

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.isFile()) {
      yield path;
    }
  }
}

function findViolations() {
  const violations = [];

  for (const file of walk(DIST_DIR)) {
    if (!SCANNED_EXTENSIONS.test(file) || statSync(file).size === 0) {
      continue;
    }

    const contents = readFileSync(file, 'utf8');
    for (const { marker, reason } of FORBIDDEN_MARKERS) {
      if (contents.includes(marker)) {
        violations.push({ file, marker, reason });
      }
    }
  }

  return violations;
}

if (!existsSync(DIST_DIR)) {
  console.error(
    `Production bundle guard FAILED: "${DIST_DIR}" not found. Run "npm run build" first.`,
  );
  process.exitCode = 1;
} else {
  const violations = findViolations();

  if (violations.length > 0) {
    console.error('Production bundle guard FAILED: demo artifacts found in the built output.\n');
    for (const { file, marker, reason } of violations) {
      console.error(`  - ${file}`);
      console.error(`      contains "${marker}" (${reason})`);
    }
    console.error(
      '\nThe production build must replace the demo providers via angular.json fileReplacements.',
    );
    process.exitCode = 1;
  } else {
    console.log('Production bundle guard OK: no demo credentials or fixtures in the built output.');
  }
}
