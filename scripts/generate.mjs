#!/usr/bin/env node
/**
 * Vertical-slice generator for the DDD Clean Architecture template.
 *
 *   npm run gen:feature -- <name> [--workflow]   # new lazy feature slice
 *   npm run gen:page    -- <feature> <pageName>  # new page inside a feature
 *
 * Generated code follows the conventions in docs/ARCHITECTURE.md. The script
 * wires the lazy route into src/app/app.routes.ts, registers the cross-feature
 * ESLint boundary zone, formats every touched file, and re-runs typecheck +
 * lint + unit tests before reporting success. On failure it prints exact
 * revert instructions.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FEATURES_DIR = join(ROOT, 'src', 'app', 'features');
const APP_ROUTES = join(ROOT, 'src', 'app', 'app.routes.ts');
const ESLINT_CONFIG = join(ROOT, 'eslint.config.mjs');
const APP_ROUTE_MARKER = '// gen:app-route';
const ESLINT_MARKER = '// gen:feature-zones';

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'feature':
    generateFeature(args);
    break;
  case 'page':
    generatePage(args);
    break;
  default:
    console.error('Usage:');
    console.error('  node scripts/generate.mjs feature <name> [--workflow]');
    console.error('  node scripts/generate.mjs page <feature> <pageName>');
    process.exit(1);
}

function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

function pascal(value) {
  return kebab(value)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function screaming(value) {
  return kebab(value).toUpperCase().replaceAll('-', '_');
}

function singular(value) {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('sses')) return value.slice(0, -2);
  if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1);
  return value;
}

function assertKebabName(value, label) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value)) {
    console.error(`${label} must be kebab-case (e.g. "orders"), got "${value}".`);
    process.exit(1);
  }
}

function run(cmd, cmdArgs) {
  return spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 32 * 1024 * 1024
  });
}

function prettier(paths) {
  const result = run('npx', ['prettier', '--write', ...paths]);
  if (result.status !== 0) {
    console.error(result.stderr);
  }
}

function writeFileIn(cwd, relativePath, content) {
  const target = join(cwd, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return target;
}

function toPosix(file) {
  return relative(ROOT, file).replaceAll('\\', '/');
}

function generateFeature(args) {
  const name = kebab(args.find((a) => !a.startsWith('--')) ?? '');
  const withWorkflow = args.includes('--workflow');
  assertKebabName(name, 'Feature name');

  const featureDir = join(FEATURES_DIR, name);
  if (existsSync(featureDir)) {
    console.error(`Feature "${name}" already exists at src/app/features/${name}.`);
    process.exit(1);
  }

  const entity = singular(name);
  const Entity = pascal(entity);
  const Feature = pascal(name);
  const TOKEN = screaming(entity);

  const created = [];
  const F = (path, content) => created.push(writeFileIn(featureDir, path, content));

  // ---- data access ---------------------------------------------------------
  F(
    `data-access/${name}.models.ts`,
    `export interface ${Entity}Summary {
  id: string;
  title: string;
  createdAt: string;
}

export interface ${Entity}Details extends ${Entity}Summary {
  description: string;
}

export interface ${Entity}Search {
  search: string;
  page: number;
  pageSize: number;
}
`,
  );

  F(
    `data-access/${entity}.repository.ts`,
    `import { InjectionToken } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { ${Entity}Details, ${Entity}Search, ${Entity}Summary } from './${name}.models';

export class ${Entity}NotFoundError extends Error {
  constructor(readonly ${entity}Id: string) {
    super(\`${Entity} "\${${entity}Id}" was not found.\`);
    this.name = '${Entity}NotFoundError';
  }
}

export interface ${Entity}Repository {
  search(query: ${Entity}Search): Promise<PagedList<${Entity}Summary>>;
  findById(id: string): Promise<${Entity}Details>;
}

export const ${TOKEN}_REPOSITORY = new InjectionToken<${Entity}Repository>(
  '${name}.${Entity}Repository'
);
`,
  );

  F(
    `data-access/in-memory-${entity}.repository.ts`,
    `import { Injectable } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { ${Entity}Details, ${Entity}Search, ${Entity}Summary } from './${name}.models';
import { ${Entity}NotFoundError, ${Entity}Repository } from './${entity}.repository';

const ITEMS: ${Entity}Details[] = [
  {
    id: '${entity}-1',
    title: 'Sample ${entity} (replace with your seed data)',
    description: 'Generated by scripts/generate.mjs — swap for a real HTTP adapter.',
    createdAt: '2025-01-01'
  }
];

@Injectable()
export class InMemory${Entity}Repository implements ${Entity}Repository {
  async search(query: ${Entity}Search): Promise<PagedList<${Entity}Summary>> {
    await this.simulateLatency();

    const term = query.search.trim().toLowerCase();
    const filtered = term
      ? ITEMS.filter((item) => item.title.toLowerCase().includes(term))
      : ITEMS;

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
    const page = Math.min(Math.max(1, query.page), totalPages);
    const start = (page - 1) * query.pageSize;

    return {
      items: filtered.slice(start, start + query.pageSize).map(toSummary),
      pageNumber: page,
      pageSize: query.pageSize,
      totalCount,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    };
  }

  async findById(id: string): Promise<${Entity}Details> {
    await this.simulateLatency();

    const found = ITEMS.find((item) => item.id === id);
    if (!found) {
      throw new ${Entity}NotFoundError(id);
    }
    return found;
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function toSummary(item: ${Entity}Details): ${Entity}Summary {
  const { description: _description, ...summary } = item;
  return summary;
}
`,
  );

  // ---- feature store ---------------------------------------------------------
  F(
    `${name}.store.ts`,
    `import { inject, Injectable, signal } from '@angular/core';
import { PagedList } from '../../shared/models/paged-list.model';
import type { ${Entity}Summary } from './data-access/${name}.models';
import { ${TOKEN}_REPOSITORY } from './data-access/${entity}.repository';

export type ListStatus = 'loading' | 'ready' | 'error';

export interface ${Entity}ListState {
  status: ListStatus;
  search: string;
  page: number;
  pageSize: number;
  result: PagedList<${Entity}Summary> | null;
  error: string | null;
}

@Injectable()
export class ${Feature}Store {
  private readonly repository = inject(${TOKEN}_REPOSITORY);

  readonly state = signal<${Entity}ListState>({
    status: 'loading',
    search: '',
    page: 1,
    pageSize: 10,
    result: null,
    error: null
  });

  load(): void {
    const current = this.state();
    void this.fetch({ search: current.search, page: current.page });
  }

  searchFor(term: string): void {
    void this.fetch({ search: term, page: 1 });
  }

  goToPage(page: number): void {
    const current = this.state();
    void this.fetch({ search: current.search, page });
  }

  private async fetch(query: { search: string; page: number }): Promise<void> {
    const current = this.state();
    this.state.update((state) => ({ ...state, status: 'loading', error: null }));

    try {
      const result = await this.repository.search({ ...query, pageSize: current.pageSize });
      this.state.set({
        status: 'ready',
        search: query.search,
        page: result.pageNumber,
        pageSize: current.pageSize,
        result,
        error: null
      });
    } catch {
      this.state.update((state) => ({
        ...state,
        status: 'error',
        error: 'The ${name} could not be loaded. Please try again.'
      }));
    }
  }
}
`,
  );

  // ---- list page ------------------------------------------------------------
  F(
    `${entity}-list/${entity}-list-page.component.ts`,
    `import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ${Feature}Store } from '../${name}.store';

@Component({
  selector: 'app-${entity}-list-page',
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './${entity}-list-page.component.html',
  styleUrl: './${entity}-list-page.component.scss'
})
export class ${Entity}ListPageComponent {
  protected readonly store = inject(${Feature}Store);
  protected readonly search = signal('');

  constructor() {
    this.store.load();
  }

  protected searchItems(): void {
    this.store.searchFor(this.search());
  }
}
`,
  );

  F(
    `${entity}-list/${entity}-list-page.component.html`,
    `<!-- TODO: add "${name}.title" et al. to core/i18n/locale-catalog.ts and use the tr pipe -->
<app-page-header title="${pascal(name)}" />

<form class="search-bar" (ngSubmit)="searchItems()">
  <label class="visually-hidden" for="${name}-search">Search ${name}</label>
  <input id="${name}-search" name="search" type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" />
  <button class="button" type="submit">Search</button>
</form>

@if (store.state(); as state) {
  @if (state.status === 'error') {
    <app-error-state message="The ${name} could not be loaded." retryLabel="Try again" (retry)="store.load()" />
  } @else if (state.status === 'loading') {
    <p role="status" class="muted">Loading…</p>
  } @else if (state.result && state.result.items.length > 0) {
    <ul class="${name}-list">
      @for (item of state.result.items; track item.id) {
        <li>
          <a [routerLink]="['/${name}', item.id]">{{ item.title }}</a>
        </li>
      }
    </ul>

    @if (state.result.totalPages > 1) {
      <nav class="pagination" aria-label="${pascal(name)} pages">
        <button class="button button--secondary" type="button" [disabled]="!state.result.hasPreviousPage" (click)="store.goToPage(state.result.pageNumber - 1)">
          Previous
        </button>
        <span class="muted">Page {{ state.result.pageNumber }} of {{ state.result.totalPages }}</span>
        <button class="button button--secondary" type="button" [disabled]="!state.result.hasNextPage" (click)="store.goToPage(state.result.pageNumber + 1)">
          Next
        </button>
      </nav>
    }
  } @else {
    <app-empty-state message="No ${name} found." />
  }
}
`,
  );

  F(
    `${entity}-list/${entity}-list-page.component.scss`,
    `.search-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);

  input {
    flex: 1;
    max-width: 320px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font: inherit;
  }
}

.${name}-list {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
  }
}

.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-4);
}
`,
  );

  // ---- detail page -----------------------------------------------------------
  F(
    `${entity}-detail/${entity}-detail-page.component.ts`,
    `import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ${Entity}Details } from '../data-access/${name}.models';
import { ${TOKEN}_REPOSITORY, ${Entity}NotFoundError } from '../data-access/${entity}.repository';

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-${entity}-detail-page',
  imports: [RouterLink],
  template: \`
    @if (status() === 'loading') {
      <p role="status" class="muted">Loading…</p>
    } @else if (status() === 'not-found') {
      <section class="card">
        <h1>${Entity} not found</h1>
        <a class="button" routerLink="/${name}">Back to ${name}</a>
      </section>
    } @else if (item(); as selected) {
      <section class="card">
        <h1>{{ selected.title }}</h1>
        <p>{{ selected.description }}</p>
        <a routerLink="/${name}">Back to ${name}</a>
      </section>
    } @else {
      <section class="card">
        <div class="error-banner" role="alert">The ${entity} could not be loaded.</div>
        <a class="button" routerLink="/${name}">Back to ${name}</a>
      </section>
    }
  \`
})
export class ${Entity}DetailPageComponent {
  private readonly repository = inject(${TOKEN}_REPOSITORY);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<DetailStatus>('loading');
  protected readonly item = signal<${Entity}Details | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.load(id);
    } else {
      this.status.set('error');
    }
  }

  private async load(id: string): Promise<void> {
    try {
      this.item.set(await this.repository.findById(id));
      this.status.set('ready');
    } catch (error) {
      this.status.set(error instanceof ${Entity}NotFoundError ? 'not-found' : 'error');
    }
  }
}
`,
  );

  // ---- routes ------------------------------------------------------------------
  F(
    `${name}.routes.ts`,
    `import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { ${Entity}DetailPageComponent } from './${entity}-detail/${entity}-detail-page.component';
import { ${Entity}ListPageComponent } from './${entity}-list/${entity}-list-page.component';
import { ${TOKEN}_REPOSITORY } from './data-access/${entity}.repository';
import { InMemory${Entity}Repository } from './data-access/in-memory-${entity}.repository';
import { ${Feature}Store } from './${name}.store';

/**
 * Feature-scoped data-access wiring. Swap the repository implementation here
 * for an HTTP adapter without touching pages or stores.
 */
const ${name}DataAccessProviders: Provider[] = [
  { provide: ${TOKEN}_REPOSITORY, useClass: InMemory${Entity}Repository }
];

export const ${screaming(name)}_ROUTES: Routes = [
  {
    path: '',
    component: ${Entity}ListPageComponent,
    providers: [...${name}DataAccessProviders, ${Feature}Store]
  },
  {
    path: ':id',
    component: ${Entity}DetailPageComponent,
    providers: [...${name}DataAccessProviders]
  }
];
`,
  );

  // ---- specs ---------------------------------------------------------------------
  F(
    `data-access/in-memory-${entity}.repository.spec.ts`,
    `import { InMemory${Entity}Repository } from './in-memory-${entity}.repository';
import { ${Entity}NotFoundError } from './${entity}.repository';

describe('InMemory${Entity}Repository (generated)', () => {
  const repository = new InMemory${Entity}Repository();

  it('returns a well-formed empty search result', async () => {
    const result = await repository.search({ search: 'zzz-no-match', page: 1, pageSize: 10 });

    expect(result.items).toEqual([]);
    expect(result.pageNumber).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBeFalse();
  });

  it('throws ${Entity}NotFoundError for unknown ids', async () => {
    await expectAsync(repository.findById('missing')).toBeRejectedWithError(${Entity}NotFoundError);
  });
});
`,
  );

  if (withWorkflow) {
    F(
      `domain/${entity}.ts`,
      `/**
 * Domain layer for ${name}: real invariants live here.
 * No Angular, HTTP, or framework imports allowed.
 */

export const ${TOKEN}_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: ['draft']
} as const;

export type ${Entity}Status = keyof typeof ${TOKEN}_TRANSITIONS;

export class ${Entity}TransitionError extends Error {
  constructor(
    readonly from: ${Entity}Status,
    readonly to: ${Entity}Status
  ) {
    super(\`Illegal ${entity} transition: \${from} -> \${to}\`);
    this.name = '${Entity}TransitionError';
  }
}

export function next${Entity}Statuses(from: ${Entity}Status): readonly ${Entity}Status[] {
  return ${TOKEN}_TRANSITIONS[from];
}

export function transition${Entity}(from: ${Entity}Status, to: ${Entity}Status): ${Entity}Status {
  if (!next${Entity}Statuses(from).includes(to)) {
    throw new ${Entity}TransitionError(from, to);
  }
  return to;
}
`,
    );

    F(
      `domain/${entity}.spec.ts`,
      `import {
  ${Entity}TransitionError,
  next${Entity}Statuses,
  transition${Entity}
} from './${entity}';

describe('${Entity} domain workflow (generated)', () => {
  it('allows the happy path draft -> submitted -> approved', () => {
    let status = transition${Entity}('draft', 'submitted');
    status = transition${Entity}(status, 'approved');
    expect(status).toBe('approved');
  });

  it('rejects skipping review', () => {
    expect(() => transition${Entity}('draft', 'approved')).toThrowError(${Entity}TransitionError);
  });

  it('approved ${name} are terminal', () => {
    expect(next${Entity}Statuses('approved')).toEqual([]);
  });
});
`,
    );
  }

  // ---- wiring ---------------------------------------------------------------------
  const routeSnippet = `      {
        path: '${name}',
        loadChildren: () =>
          import('./features/${name}/${name}.routes').then((m) => m.${screaming(name)}_ROUTES)
      },
`;
  insertAtMarker(APP_ROUTES, APP_ROUTE_MARKER, routeSnippet, `features/${name}`);

  const zoneSnippet = `            {
              target: './features/${name}',
              from: './features',
              except: ['./${name}'],
              message: 'cross-feature import: expose a contract instead'
            },
`;
  insertAtMarker(ESLINT_CONFIG, ESLINT_MARKER, zoneSnippet, `target: './features/${name}'`);

  prettier([...created.map(toPosix), 'src/app/app.routes.ts', 'eslint.config.mjs']);

  console.log(
    `Created feature "${name}" (${created.length} files)${withWorkflow ? ' with domain workflow' : ''}.`
  );
  console.log('Inserted the lazy route into app.routes.ts and the boundary zone into eslint.config.mjs.');

  verify(name);

  console.log('\nNext steps:');
  console.log(`  1. Replace seed data and TODOs in src/app/features/${name}.`);
  console.log(`  2. Add "${name}.*" translations to src/app/core/i18n/locale-catalog.ts and switch to the tr pipe.`);
  console.log(`  3. To protect routes: permissionGuard(AppPermissions.${entity}Read) — register the permission in core/authorization/app-permissions.ts and the demo adapter.`);
  console.log(`  4. To use a real backend: implement the repository with BaseHttpService (docs/recipes/backend-cutover.md).`);
}

function generatePage(args) {
  const feature = kebab(args[0] ?? '');
  const page = kebab(args[1] ?? '');
  assertKebabName(feature, 'Feature name');
  assertKebabName(page, 'Page name');

  const featureDir = join(FEATURES_DIR, feature);
  if (!existsSync(featureDir)) {
    console.error(`Feature "${feature}" does not exist (src/app/features/${feature}).`);
    process.exit(1);
  }

  const pageDir = join(featureDir, `${page}-page`);
  if (existsSync(pageDir)) {
    console.error(`Page "${page}" already exists in feature "${feature}".`);
    process.exit(1);
  }

  const Page = pascal(page);
  const routesFile = join(featureDir, `${feature}.routes.ts`);
  const source = readFileSync(routesFile, 'utf8');
  if (source.includes(`${page}-page`)) {
    console.error(`Route for "${page}" already registered in ${feature}.routes.ts.`);
    process.exit(1);
  }

  const created = [
    writeFileIn(
      featureDir,
      `${page}-page/${page}-page.component.ts`,
      `import { Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'app-${page}-page',
  imports: [PageHeaderComponent],
  template: \`
    <app-page-header title="${Page}" />
    <!-- TODO: build the ${page} slice content -->
    <section class="card">
      <p class="muted">New page scaffold — owned by the "${feature}" feature.</p>
    </section>
  \`
})
export class ${Page}PageComponent {}
`,
    )
  ];

  const importLine = `import { ${Page}PageComponent } from './${page}-page/${page}-page.component';`;

  let patched = source;
  if (!patched.includes(importLine)) {
    // Append after the last single-line import of the file.
    const importLineRegex = /^import\s+[^\n]*\n/gm;
    let lastIndex = 0;
    for (const match of patched.matchAll(importLineRegex)) {
      lastIndex = match.index + match[0].length;
    }
    patched =
      lastIndex === 0
        ? `${importLine}\n\n${patched}`
        : patched.slice(0, lastIndex) + `${importLine}\n` + patched.slice(lastIndex);
  }

  // Static page routes go FIRST so they are matched before ':id'.
  const headerIndex = patched.search(/Routes\s*=\s*\[/);
  if (headerIndex === -1) {
    console.error(`Could not locate the Routes array in ${feature}.routes.ts.`);
    process.exit(1);
  }
  const insertPos = patched.indexOf('\n', headerIndex) + 1;
  patched =
    patched.slice(0, insertPos) +
    `  {\n    path: '${page}',\n    component: ${Page}PageComponent\n  },\n` +
    patched.slice(insertPos);
  writeFileSync(routesFile, patched, 'utf8');
  created.push(routesFile);

  prettier(created.map(toPosix));

  console.log(`Created page "${page}" in feature "${feature}" and registered its route.`);
  verify(feature);

  console.log(
    `\nPath available at /${feature}/${page}. The route was inserted before the ':id' route so it matches first.`
  );
}

function insertAtMarker(file, marker, snippet, guardText) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(guardText)) {
    console.error(`Wiring for "${guardText}" already exists in ${toPosix(file)} — aborting before changes.`);
    process.exit(1);
  }

  const index = source.indexOf(marker);
  if (index === -1) {
    console.error(`Marker "${marker}" not found in ${toPosix(file)}. Restore it or update the generator.`);
    process.exit(1);
  }

  const lineStart = source.lastIndexOf('\n', index) + 1;
  writeFileSync(file, source.slice(0, lineStart) + snippet + source.slice(lineStart), 'utf8');
}

function verify(label) {
  console.log('Verifying generated code against the repository gates...');
  const steps = [
    ['npx', ['tsc', '--noEmit', '-p', 'tsconfig.app.json']],
    ['npx', ['eslint', '.']],
    ['npx', ['ng', 'test', '--no-watch', '--browsers=ChromeHeadless']]
  ];

  for (const [cmd, cmdArgs] of steps) {
    const result = run(cmd, cmdArgs);
    if (result.status !== 0) {
      console.error(`\nVerification failed: ${cmd} ${cmdArgs.join(' ')}`);
      console.error(result.stdout ?? '');
      console.error(result.stderr ?? '');
      console.error(
        `\nRevert: delete src/app/features/<name>/ and remove every line mentioning "<name>" from src/app/app.routes.ts and eslint.config.mjs (or use your editor's undo).`
      );
      process.exit(1);
    }
  }

  console.log(`Generated slice "${label}" passes typecheck, lint (boundaries included), and all unit tests.`);
}
