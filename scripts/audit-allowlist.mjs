#!/usr/bin/env node
/**
 * Dependency audit gate with explicit, expiring risk acceptance for
 * dev-only advisories that have no shipped fix yet.
 *
 * Policy:
 *  - Any HIGH/CRITICAL in PRODUCTION dependencies fails (also enforced by
 *    `npm audit --omit=dev --audit-level=high`).
 *  - HIGH/CRITICAL dev advisories pass only while listed in
 *    audit-allowlist.json with a reason and a future expiry date.
 *  - Everything else fails closed.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowlist = JSON.parse(readFileSync(join(root, 'audit-allowlist.json'), 'utf8'));

// Single command string with shell:true avoids the EINVAL on .cmd spawns on
// Windows and the DEP0190 warning (no args array passed).
const result = spawnSync('npm audit --json', {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit did not return parseable JSON. npm exit code:', result.status);
  process.exit(2);
}

const BLOCKING = new Set(['high', 'critical']);
const now = new Date();

/** Collect every distinct advisory contributing to blocking vulnerabilities. */
const findings = new Map();
for (const [pkgName, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via === 'string') {
      continue;
    }
    if (!BLOCKING.has(via.severity)) {
      continue;
    }
    const id = via.url || via.title;
    const existing = findings.get(id) ?? { title: via.title, severity: via.severity, packages: [] };
    existing.packages.push(pkgName);
    findings.set(id, existing);
  }
}

const accepted = new Map(allowlist.accepted.map(entry => [entry.url, entry]));
const violations = [];

for (const [url, finding] of findings) {
  const entry = accepted.get(url);
  if (!entry) {
    violations.push(`UNACCEPTED [${finding.severity}] ${finding.title}\n  advisory: ${url}\n  packages: ${[...new Set(finding.packages)].join(', ')}`);
    continue;
  }

  if (new Date(entry.expires) < now) {
    violations.push(`EXPIRED allowance (${entry.expires}) ${finding.title}\n  advisory: ${url}\n  packages: ${[...new Set(finding.packages)].join(', ')}`);
    continue;
  }

  if (!entry.devOnly) {
    violations.push(`ALLOWLIST ERROR: "${finding.title}" is marked non-devOnly but appears in the dependency tree; production highs must be fixed, not allowed.\n  advisory: ${url}`);
  }
}

if (violations.length > 0) {
  console.error('Audit gate failed:\n');
  console.error(violations.join('\n\n'));
  console.error('\nFix the dependency, or update audit-allowlist.json with justification and an expiry (dev-only findings).');
  process.exit(1);
}

console.log(`Audit gate passed. ${findings.size} blocking advisory/ies, all accepted as dev-only with valid expiry.`);
