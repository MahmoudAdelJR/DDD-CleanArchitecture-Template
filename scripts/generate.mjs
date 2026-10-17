#!/usr/bin/env node
/**
 * Vertical-slice generator for the DDD Clean Architecture template.
 *
 *   npm run gen:feature -- <name> [--workflow]   # new lazy feature slice
 *   npm run gen:page    -- <feature> <pageName>  # new page inside a feature
 *
 * The generator is transactional: it validates arguments and wiring
 * preflight-only, computes every change in memory, snapshots touched files,
 * then applies, formats, and verifies (architecture check, typecheck, lint,
 * unit tests). ANY failure rolls the workspace back to its exact prior state.
 *
 * Imported entry point (runGenerator/checkArchitecture) so integration tests
 * can run it against throwaway fixture workspaces with an injected runner.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { Transaction, defaultRunCommand, makeToolRunner } from './workspace.mjs';

export { defaultRunCommand } from './workspace.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(join(dirname(MODULE_PATH), '..'));

const APP_ROUTE_MARKER = '// gen:app-route';
const ESLINT_MARKER = '// gen:feature-zones';

class GeneratorError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeneratorError';
  }
}

// ---------------------------------------------------------------------------
// naming helpers
// ---------------------------------------------------------------------------

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
    throw new GeneratorError(`${label} must be kebab-case (e.g. "orders"), got "${value}".`);
  }
}

// ---------------------------------------------------------------------------
// strict argument parsing (raw values, no silent normalization)
// ---------------------------------------------------------------------------

function parseFeatureArgs(args) {
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));
  const unknown = flags.filter((f) => f !== '--workflow');
  if (unknown.length > 0) {
    throw new GeneratorError(
      `Unknown flag(s): ${unknown.join(', ')}. Usage: feature <name> [--workflow]`,
    );
  }
  if (positional.length !== 1) {
    throw new GeneratorError(
      'Usage: feature <name> [--workflow] — exactly one feature name expected.',
    );
  }
  const name = positional[0];
  assertKebabName(name, 'Feature name');
  return { name, withWorkflow: flags.includes('--workflow') };
}

function parsePageArgs(args) {
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));
  if (flags.length > 0) {
    throw new GeneratorError(
      `gen:page takes no flags, got: ${flags.join(', ')}. Usage: page <feature> <pageName>`,
    );
  }
  if (positional.length !== 2) {
    throw new GeneratorError('Usage: page <feature> <pageName> — exactly two names expected.');
  }
  assertKebabName(positional[0], 'Feature name');
  assertKebabName(positional[1], 'Page name');
  return { feature: positional[0], page: positional[1] };
}

// ---------------------------------------------------------------------------
// (Transaction + makeToolRunner + defaultRunCommand live in workspace.mjs)
// ---------------------------------------------------------------------------

function verify(ctx, runTool) {
  const steps = [
    ['checkArchitecture', [], 'slice wiring integrity'],
    ['tsc', ['--noEmit', '-p', 'tsconfig.app.json'], 'app typecheck'],
    ['eslint', ['.'], 'lint + boundaries'],
    ['ng', ['test', '--no-watch', '--browsers=ChromeHeadless'], 'unit tests'],
  ];
  ctx.log(`Verifying: ${steps.map((s) => s[2]).join(' → ')}…`);
  for (const [tool, args] of steps) runTool(tool, args);
}

// ---------------------------------------------------------------------------
// marker wiring (feature mode)
// ---------------------------------------------------------------------------

function findMarkerLine(source, marker) {
  const lines = source.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, index) => {
    if (line.trim().startsWith(marker)) hits.push(index);
  });
  if (hits.length === 0) {
    throw new GeneratorError(
      `Marker "${marker}" not found. Restore it (see docs/ARCHITECTURE.md) or update the generator.`,
    );
  }
  if (hits.length > 1) {
    throw new GeneratorError(
      `Marker "${marker}" must appear exactly once, found ${hits.length} times.`,
    );
  }
  return hits[0];
}

function spliceAtLine(source, lineIndex, snippetLines) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/);
  const indent = lines[lineIndex].match(/^\s*/)[0];
  const snippet = snippetLines.map((line) => (line ? `${indent}${line}` : line));
  return [...lines.slice(0, lineIndex), ...snippet, ...lines.slice(lineIndex)].join(eol);
}

function routeSnippetLines(name) {
  return [
    `{`,
    `path: '${name}',`,
    `loadChildren: () =>`,
    `import('./features/${name}/${name}.routes').then((m) => m.${screaming(name)}_ROUTES),`,
    `},`,
  ];
}

function zoneSnippetLines(name) {
  return [
    `{`,
    `target: './features/${name}',`,
    `from: './features',`,
    `except: ['./${name}'],`,
    `message: 'cross-feature import: expose a contract instead',`,
    `},`,
  ];
}

// ---------------------------------------------------------------------------
// page route patching via TypeScript AST (handles one-line arrays, inserts
// static pages before ':id'/'**' routes, detects duplicate paths)
// ---------------------------------------------------------------------------

function findRoutesArray(sf) {
  let found = null;
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declarations = statement.declarationList.declarations;
    if (declarations.length !== 1) continue;
    const decl = declarations[0];
    if (
      decl.initializer &&
      ts.isArrayLiteralExpression(decl.initializer) &&
      decl.type &&
      decl.type.getText(sf) === 'Routes'
    ) {
      if (found) throw new GeneratorError('Multiple Routes array declarations found — ambiguous.');
      found = decl.initializer;
    }
  }
  if (!found) {
    throw new GeneratorError(
      'Could not locate a `: Routes = [...]` array literal in the routes file.',
    );
  }
  return found;
}

function insertPageRoute(source, feature, page, Page) {
  const sf = ts.createSourceFile(`${feature}.routes.ts`, source, ts.ScriptTarget.Latest, true);
  const array = findRoutesArray(sf);
  const elements = array.elements;

  let insertIndex = elements.length;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!ts.isObjectLiteralExpression(el)) continue;
    for (const prop of el.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const nameNode = prop.name;
      const nameText = ts.isStringLiteral(nameNode) ? nameNode.text : nameNode.getText(sf);
      if (nameText !== 'path') continue;
      if (!ts.isStringLiteral(prop.initializer)) continue;
      const value = prop.initializer.text;
      if (value === page) {
        throw new GeneratorError(
          `A route with path '${page}' already exists in ${feature}.routes.ts.`,
        );
      }
      if ((value.startsWith(':') || value === '**') && insertIndex === elements.length) {
        insertIndex = i;
      }
    }
  }

  const newRoute = `{\npath: '${page}',\ncomponent: ${Page}PageComponent,\n}`;
  const importLine = `import { ${Page}PageComponent } from './${page}-page/${page}-page.component';`;
  if (source.includes(importLine)) {
    throw new GeneratorError(`Import for page '${page}' already exists in ${feature}.routes.ts.`);
  }

  const edits = [];
  let lastImport = null;
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) lastImport = statement;
  }
  if (lastImport) edits.push({ pos: lastImport.getEnd(), text: `\n${importLine}` });
  else
    edits.push({
      pos: sf.statements.length > 0 ? sf.getStart(sf.statements[0]) : 0,
      text: `${importLine}\n\n`,
    });

  if (elements.length === 0) {
    edits.push({ pos: array.getStart(sf) + 1, text: `\n${newRoute},\n` });
  } else if (insertIndex < elements.length) {
    edits.push({ pos: elements[insertIndex].getStart(sf), text: `${newRoute},\n` });
  } else {
    edits.push({ pos: elements[elements.length - 1].getEnd(), text: `,\n${newRoute}` });
  }

  edits.sort((a, b) => b.pos - a.pos);
  let patched = source;
  for (const edit of edits) {
    patched = patched.slice(0, edit.pos) + edit.text + patched.slice(edit.pos);
  }
  return patched;
}

// ---------------------------------------------------------------------------
// generated file templates
// ---------------------------------------------------------------------------

function buildFeatureFiles(name, withWorkflow) {
  const entity = singular(name);
  const Entity = pascal(entity);
  const Feature = pascal(name);
  const TOKEN = screaming(entity);
  const files = [];
  const F = (path, content) => files.push([path, content]);

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
    await this.delay();

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
    await this.delay();

    const found = ITEMS.find((item) => item.id === id);
    if (!found) {
      throw new ${Entity}NotFoundError(id);
    }
    return found;
  }

  private delay(): Promise<void> {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
}

function toSummary(item: ${Entity}Details): ${Entity}Summary {
  const { description: _description, ...summary } = item;
  return summary;
}
`,
  );

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

  return { entity, Entity, Feature, TOKEN, files };
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

function toPosix(root, file) {
  return relative(root, file).split('\\').join('/');
}

function generateFeature(ctx, args) {
  const { root, log } = ctx;
  const { name, withWorkflow } = parseFeatureArgs(args);
  const featureDir = join(root, 'src', 'app', 'features', name);
  const appRoutesPath = join(root, 'src', 'app', 'app.routes.ts');
  const eslintPath = join(root, 'eslint.config.mjs');

  if (existsSync(featureDir)) {
    throw new GeneratorError(
      `Feature "${name}" already exists at src/app/features/${name}. No changes were made.`,
    );
  }

  // ---- preflight: everything validated before any write ----
  if (!existsSync(appRoutesPath)) throw new GeneratorError('src/app/app.routes.ts is missing.');
  if (!existsSync(eslintPath)) throw new GeneratorError('eslint.config.mjs is missing.');
  const appRoutesSource = readFileSync(appRoutesPath, 'utf8');
  const eslintSource = readFileSync(eslintPath, 'utf8');

  if (appRoutesSource.includes(`'./features/${name}/${name}.routes'`)) {
    throw new GeneratorError(`app.routes.ts already references feature "${name}".`);
  }
  if (eslintSource.includes(`'./features/${name}'`)) {
    throw new GeneratorError(`eslint.config.mjs already has a boundary zone for "${name}".`);
  }

  const appRouteLine = findMarkerLine(appRoutesSource, APP_ROUTE_MARKER);
  const eslintMarkerLine = findMarkerLine(eslintSource, ESLINT_MARKER);
  const { entity, Entity, Feature, TOKEN, files } = buildFeatureFiles(name, withWorkflow);

  const patchedRoutes = spliceAtLine(appRoutesSource, appRouteLine, routeSnippetLines(name));
  const patchedEslint = spliceAtLine(eslintSource, eslintMarkerLine, zoneSnippetLines(name));

  // ---- apply (transactional) ----
  const tx = new Transaction([featureDir]);
  const runTool = makeToolRunner(ctx);
  try {
    tx.patchFile(appRoutesPath, patchedRoutes);
    tx.patchFile(eslintPath, patchedEslint);
    for (const [rel, content] of files) tx.writeFile(join(featureDir, rel), content);

    runTool('prettier', [
      '--write',
      ...files.map(([rel]) => toPosix(root, join(featureDir, rel))),
      'src/app/app.routes.ts',
      'eslint.config.mjs',
    ]);
    verify(ctx, runTool);
    tx.commit();
  } catch (error) {
    const problems = tx.rollback();
    throw new GeneratorError(
      `${error.message}\nWorkspace rolled back.${problems.length ? ` ROLLBACK INCOMPLETE: ${problems.join('; ')}` : ''}`,
    );
  }

  log(
    `Created feature "${name}" (${files.length} files)${withWorkflow ? ' with domain workflow' : ''}.`,
  );
  log('Lazy route + ESLint boundary zone wired; all gates passed.');
  log('\nNext steps:');
  log(`  1. Replace seed data and TODOs in src/app/features/${name}.`);
  log(
    `  2. Add "${name}.*" translations to src/app/core/i18n/locale-catalog.ts and switch to the tr pipe.`,
  );
  log(
    `  3. Protect routes with permissionGuard — register the permission in core/authorization/app-permissions.ts.`,
  );
  log(
    `  4. Real backend? Implement the repository with BaseHttpService (docs/recipes/backend-cutover.md).`,
  );
  return { feature: name, entity, Entity, Feature, TOKEN };
}

function generatePage(ctx, args) {
  const { root, log } = ctx;
  const { feature, page } = parsePageArgs(args);
  const featureDir = join(root, 'src', 'app', 'features', feature);
  const routesPath = join(featureDir, `${feature}.routes.ts`);
  const pageDir = join(featureDir, `${page}-page`);

  if (!existsSync(featureDir)) {
    throw new GeneratorError(`Feature "${feature}" does not exist (src/app/features/${feature}).`);
  }
  if (!existsSync(routesPath)) {
    throw new GeneratorError(
      `Feature "${feature}" has no ${feature}.routes.ts — cannot wire a page route.`,
    );
  }
  if (existsSync(pageDir)) {
    throw new GeneratorError(
      `Page "${page}" already exists in feature "${feature}". No changes were made.`,
    );
  }

  const Page = pascal(page);
  const source = readFileSync(routesPath, 'utf8');
  const patched = insertPageRoute(source, feature, page, Page); // pure preflight

  const componentContent = `import { Component } from '@angular/core';
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
`;

  const tx = new Transaction([pageDir]);
  const runTool = makeToolRunner(ctx);
  try {
    tx.writeFile(join(pageDir, `${page}-page.component.ts`), componentContent);
    tx.patchFile(routesPath, patched);

    runTool('prettier', [
      '--write',
      toPosix(root, join(pageDir, `${page}-page.component.ts`)),
      toPosix(root, routesPath),
    ]);
    verify(ctx, runTool);
    tx.commit();
  } catch (error) {
    const problems = tx.rollback();
    throw new GeneratorError(
      `${error.message}\nWorkspace rolled back.${problems.length ? ` ROLLBACK INCOMPLETE: ${problems.join('; ')}` : ''}`,
    );
  }

  log(`Created page "${page}" in feature "${feature}" and registered its route.`);
  log(`Path available at /${feature}/${page} (inserted before any ':id' or wildcard route).`);
  return { feature, page };
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

export function runGenerator({
  argv,
  root = DEFAULT_ROOT,
  runCommand = defaultRunCommand,
  log = (message) => console.log(message),
} = {}) {
  const [command, ...args] = argv;
  const ctx = { root, runCommand, log };

  switch (command) {
    case 'feature':
      return generateFeature(ctx, args);
    case 'page':
      return generatePage(ctx, args);
    default:
      throw new GeneratorError(
        'Usage:\n  node scripts/generate.mjs feature <name> [--workflow]\n  node scripts/generate.mjs page <feature> <pageName>',
      );
  }
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  try {
    runGenerator({ argv: process.argv.slice(2) });
  } catch (error) {
    console.error(`\nGenerator FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}
