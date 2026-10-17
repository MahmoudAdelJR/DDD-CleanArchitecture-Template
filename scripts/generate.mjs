#!/usr/bin/env node
/**
 * Vertical-slice generator for the DDD Clean Architecture template.
 *
 *   npm run gen:feature -- <name> [--read-only] [--workflow]   # new lazy feature slice
 *   npm run gen:page    -- <feature> <pageName>                # new page inside a feature
 *
 * Feature mode defaults to a full create/read/update ("crud") slice that mirrors
 * the customers feature: list + detail + form, in-memory fake wired through a
 * data-access provider file, an HTTP adapter, and an angular.json production
 * fileReplacement. Pass --read-only for a list + detail slice without writes.
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

function camel(value) {
  const value_ = pascal(value);
  return value_.charAt(0).toLowerCase() + value_.slice(1);
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

const FEATURE_FLAGS = ['--workflow', '--read-only', '--crud'];

function parseFeatureArgs(args) {
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));
  const unknown = flags.filter((f) => !FEATURE_FLAGS.includes(f));
  if (unknown.length > 0) {
    throw new GeneratorError(
      `Unknown flag(s): ${unknown.join(', ')}. Usage: feature <name> [--read-only] [--workflow]`,
    );
  }
  if (positional.length !== 1) {
    throw new GeneratorError(
      'Usage: feature <name> [--read-only] [--workflow] — exactly one feature name expected.',
    );
  }
  const readOnly = flags.includes('--read-only');
  if (readOnly && flags.includes('--crud')) {
    throw new GeneratorError('--read-only and --crud are mutually exclusive.');
  }
  const name = positional[0];
  assertKebabName(name, 'Feature name');
  return { name, withWorkflow: flags.includes('--workflow'), readOnly };
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
// angular.json production fileReplacement wiring (pure; throws on problems)
// ---------------------------------------------------------------------------

function providersReplacePath(name) {
  return `src/app/features/${name}/data-access/${name}-data-access.providers.ts`;
}

function patchAngularJson(source, name) {
  let config;
  try {
    config = JSON.parse(source);
  } catch {
    throw new GeneratorError('angular.json is not valid JSON.');
  }

  const replace = providersReplacePath(name);
  const withPath = replace.replace(/\.providers\.ts$/, '.providers.production.ts');

  for (const project of Object.values(config.projects ?? {})) {
    const production = project?.architect?.build?.configurations?.production;
    const replacements = production?.fileReplacements;
    if (!Array.isArray(replacements)) continue;
    if (replacements.some((entry) => entry?.replace === replace)) {
      throw new GeneratorError(`angular.json already replaces ${replace}.`);
    }
    replacements.push({ replace, with: withPath });
    return `${JSON.stringify(config, null, 2)}\n`;
  }

  throw new GeneratorError(
    'No application project with build.configurations.production.fileReplacements found in angular.json.',
  );
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

function buildFeatureFiles(name, withWorkflow, readOnly) {
  const entity = singular(name);
  const Entity = pascal(entity);
  const Feature = pascal(name);
  const TOKEN = screaming(entity);
  const Title = Entity;
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
${
  readOnly
    ? ''
    : `
/**
 * Command model for creating or updating a ${entity}. Owned by this slice: the
 * server transport shape and the reactive-form value both map onto it.
 */
export interface ${Entity}Input {
  title: string;
  description: string;
}
`
}`,
  );

  F(
    `data-access/${entity}.repository.ts`,
    `import { InjectionToken } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { ${Entity}Details${
      readOnly ? '' : `, ${Entity}Input`
    }, ${Entity}Search, ${Entity}Summary } from './${name}.models';

export class ${Entity}NotFoundError extends Error {
  constructor(readonly ${camel(entity)}Id: string) {
    super('${Entity} "' + ${camel(entity)}Id + '" was not found.');
    this.name = '${Entity}NotFoundError';
  }
}
${
  readOnly
    ? ''
    : `
/**
 * Raised when a write is rejected because it conflicts with existing data
 * (HTTP 409). Distinct from validation failures, which arrive as field-level
 * ApiError.validationErrors.
 */
export class ${Entity}ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = '${Entity}ConflictError';
  }
}
`
}
export interface ${Entity}Repository {
  search(query: ${Entity}Search): Promise<PagedList<${Entity}Summary>>;
  findById(id: string): Promise<${Entity}Details>;${
    readOnly
      ? ''
      : `
  create(input: ${Entity}Input): Promise<${Entity}Details>;
  update(id: string, input: ${Entity}Input): Promise<${Entity}Details>;`
  }
}

export const ${TOKEN}_REPOSITORY = new InjectionToken<${Entity}Repository>(
  '${name}.${Entity}Repository',
);
`,
  );

  F(
    `data-access/in-memory-${entity}.repository.ts`,
    readOnly
      ? `import { Injectable } from '@angular/core';
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
    const filtered = term ? ITEMS.filter((item) => item.title.toLowerCase().includes(term)) : ITEMS;

    return paginate(filtered, query);
  }

  async findById(id: string): Promise<${Entity}Details> {
    await this.simulateLatency();

    const found = ITEMS.find((item) => item.id === id);
    if (!found) {
      throw new ${Entity}NotFoundError(id);
    }
    return { ...found };
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
}

function paginate(
  items: readonly ${Entity}Details[],
  query: ${Entity}Search
): PagedList<${Entity}Summary> {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    items: items.slice(start, start + query.pageSize).map(toSummary),
    pageNumber: page,
    pageSize: query.pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages
  };
}

function toSummary(item: ${Entity}Details): ${Entity}Summary {
  const { description: _description, ...summary } = item;
  return summary;
}
`
      : `import { Injectable } from '@angular/core';
import { PagedList } from '../../../shared/models/paged-list.model';
import type {
  ${Entity}Details,
  ${Entity}Input,
  ${Entity}Search,
  ${Entity}Summary
} from './${name}.models';
import {
  ${Entity}ConflictError,
  ${Entity}NotFoundError,
  ${Entity}Repository
} from './${entity}.repository';

function createSeed(): ${Entity}Details[] {
  return [
    {
      id: '${entity}-1',
      title: 'Sample ${entity} (replace with your seed data)',
      description: 'Generated by scripts/generate.mjs — swap for a real HTTP adapter.',
      createdAt: '2025-01-01'
    }
  ];
}

/**
 * Module-level store so writes made through one route-scoped instance are
 * visible after navigating to a route that provisions a fresh instance. It is
 * demo state only and resets on reload; the real adapter persists server-side.
 */
let items: ${Entity}Details[] = createSeed();
let nextSequence = items.length + 1;

/** Restores the seed data. For tests and demo resets only. */
export function resetInMemory${Entity}s(): void {
  items = createSeed();
  nextSequence = items.length + 1;
}

@Injectable()
export class InMemory${Entity}Repository implements ${Entity}Repository {
  async search(query: ${Entity}Search): Promise<PagedList<${Entity}Summary>> {
    await this.simulateLatency();

    const term = query.search.trim().toLowerCase();
    const filtered = term ? items.filter((item) => item.title.toLowerCase().includes(term)) : items;

    return paginate(filtered, query);
  }

  async findById(id: string): Promise<${Entity}Details> {
    await this.simulateLatency();
    return clone(findOrThrow(id));
  }

  async create(input: ${Entity}Input): Promise<${Entity}Details> {
    await this.simulateLatency();
    assertTitleAvailable(input.title, null);

    const created: ${Entity}Details = {
      id: \`${entity}-\${nextSequence++}\`,
      title: input.title.trim(),
      description: input.description.trim(),
      createdAt: new Date().toISOString().slice(0, 10)
    };
    items = [created, ...items];
    return clone(created);
  }

  async update(id: string, input: ${Entity}Input): Promise<${Entity}Details> {
    await this.simulateLatency();
    const existing = findOrThrow(id);
    assertTitleAvailable(input.title, id);

    const updated: ${Entity}Details = {
      ...existing,
      title: input.title.trim(),
      description: input.description.trim()
    };
    items = items.map((item) => (item.id === id ? updated : item));
    return clone(updated);
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
}

function findOrThrow(id: string): ${Entity}Details {
  const found = items.find((item) => item.id === id);
  if (!found) {
    throw new ${Entity}NotFoundError(id);
  }
  return found;
}

function assertTitleAvailable(title: string, exceptId: string | null): void {
  const normalized = title.trim().toLowerCase();
  const clash = items.some(
    (item) => item.id !== exceptId && item.title.trim().toLowerCase() === normalized
  );
  if (clash) {
    throw new ${Entity}ConflictError('A ${entity} with this title already exists.');
  }
}

/** Returns a copy so callers cannot mutate the in-memory store by reference. */
function clone(item: ${Entity}Details): ${Entity}Details {
  return { ...item };
}

function paginate(
  source: readonly ${Entity}Details[],
  query: ${Entity}Search
): PagedList<${Entity}Summary> {
  const totalCount = source.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    items: source.slice(start, start + query.pageSize).map(toSummary),
    pageNumber: page,
    pageSize: query.pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages
  };
}

function toSummary(item: ${Entity}Details): ${Entity}Summary {
  const { description: _description, ...summary } = item;
  return summary;
}
`,
  );

  F(
    `data-access/${entity}-http.repository.ts`,
    `${
      readOnly ? '' : "import { HttpContext } from '@angular/common/http';\n"
    }import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { isApiError } from '../../../core/http/api-error';
${
  readOnly ? '' : "import { SUPPRESS_GLOBAL_ERROR } from '../../../core/http/http-context';\n"
}import { BaseHttpService } from '../../../core/services/base-http.service';
import { PagedList } from '../../../shared/models/paged-list.model';
import type { ${Entity}Details${
      readOnly ? '' : `, ${Entity}Input`
    }, ${Entity}Search, ${Entity}Summary } from './${name}.models';
import { ${Entity}NotFoundError${
      readOnly ? '' : `, ${Entity}ConflictError`
    }, ${Entity}Repository } from './${entity}.repository';

/**
 * Real-backend data access for the ${name} slice. Enable AppConfig.mockApi
 * during development to exercise it against dev fixtures, and swap it into
 * ${name}-data-access.providers.production.ts for production builds.
 *${
   readOnly
     ? ''
     : `
 * Writes run with SUPPRESS_GLOBAL_ERROR so the form owns its error surface
 * (field-level validation + an inline banner) instead of also raising a toast.`
 }
 */
@Injectable()
export class ${Entity}HttpRepository extends BaseHttpService implements ${Entity}Repository {
  private readonly config = inject(APP_CONFIG);

  private resourceUrl(path = ''): string {
    return this.config.apiBaseUrl + '/${name}' + path;
  }

  async search(query: ${Entity}Search): Promise<PagedList<${Entity}Summary>> {
    return firstValueFrom(
      this.get<PagedList<${Entity}Summary>>(this.resourceUrl(), {
        search: query.search,
        page: query.page,
        pageSize: query.pageSize
      })
    );
  }

  async findById(id: string): Promise<${Entity}Details> {
    try {
      return await firstValueFrom(this.get<${Entity}Details>(this.resourceUrl('/' + id)));
    } catch (error) {
      // The global error interceptor rethrows ApiError, not HttpErrorResponse.
      if (isApiError(error) && error.status === 404) {
        throw new ${Entity}NotFoundError(id);
      }
      throw error;
    }
  }${
    readOnly
      ? ''
      : `

  async create(input: ${Entity}Input): Promise<${Entity}Details> {
    try {
      return await firstValueFrom(
        this.post<${Entity}Details>(this.resourceUrl(), input, undefined, writeContext())
      );
    } catch (error) {
      throw mapWriteError(error, null);
    }
  }

  async update(id: string, input: ${Entity}Input): Promise<${Entity}Details> {
    try {
      return await firstValueFrom(
        this.put<${Entity}Details>(this.resourceUrl('/' + id), input, writeContext())
      );
    } catch (error) {
      throw mapWriteError(error, id);
    }
  }`
  }
}
${
  readOnly
    ? ''
    : `
function writeContext(): HttpContext {
  return new HttpContext().set(SUPPRESS_GLOBAL_ERROR, true);
}

function mapWriteError(error: unknown, id: string | null): unknown {
  if (isApiError(error)) {
    if (id && error.status === 404) {
      return new ${Entity}NotFoundError(id);
    }
    if (error.status === 409) {
      return new ${Entity}ConflictError(error.message);
    }
  }
  return error;
}
`
}`,
  );

  F(
    `data-access/${name}-data-access.providers.ts`,
    `import { Provider } from '@angular/core';
import { InMemory${Entity}Repository } from './in-memory-${entity}.repository';
import { ${TOKEN}_REPOSITORY } from './${entity}.repository';

/**
 * Feature-scoped data-access wiring (development/demo default).
 *
 * Swap the repository implementation here to move from the in-memory fake to
 * a real HTTP adapter without touching the pages or the store. Production
 * builds replace this file with \`${name}-data-access.providers.production.ts\`
 * via angular.json \`fileReplacements\`.
 */
export const ${camel(name)}DataAccessProviders: Provider[] = [
  { provide: ${TOKEN}_REPOSITORY, useClass: InMemory${Entity}Repository }
];
`,
  );

  F(
    `data-access/${name}-data-access.providers.production.ts`,
    `import { Provider } from '@angular/core';
import { ${Entity}HttpRepository } from './${entity}-http.repository';
import { ${TOKEN}_REPOSITORY } from './${entity}.repository';

/**
 * Production data-access wiring: the ${name} slice talks to the real backend.
 * Replaces \`${name}-data-access.providers.ts\` via angular.json
 * \`fileReplacements\`, so the in-memory fake is not bundled for release.
 */
export const ${camel(name)}DataAccessProviders: Provider[] = [
  { provide: ${TOKEN}_REPOSITORY, useClass: ${Entity}HttpRepository }
];
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

  private readonly _state = signal<${Entity}ListState>({
    status: 'loading',
    search: '',
    page: 1,
    pageSize: 10,
    result: null,
    error: null
  });
  readonly state = this._state.asReadonly();

  /**
   * Monotonic token so overlapping searches can't commit out of order: only
   * the response for the most recent request is applied (latest-request-wins).
   */
  private latestRequest = 0;

  load(): void {
    const current = this._state();
    void this.fetch({ search: current.search, page: current.page });
  }

  searchFor(term: string): void {
    void this.fetch({ search: term, page: 1 });
  }

  goToPage(page: number): void {
    const current = this._state();
    void this.fetch({ search: current.search, page });
  }

  private async fetch(query: { search: string; page: number }): Promise<void> {
    const requestId = ++this.latestRequest;
    const current = this._state();
    this._state.update((state) => ({ ...state, status: 'loading', error: null }));

    try {
      const result = await this.repository.search({ ...query, pageSize: current.pageSize });
      if (requestId !== this.latestRequest) {
        return;
      }
      this._state.set({
        status: 'ready',
        search: query.search,
        page: result.pageNumber,
        pageSize: current.pageSize,
        result,
        error: null
      });
    } catch {
      if (requestId !== this.latestRequest) {
        return;
      }
      this._state.update((state) => ({
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
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../shared/ui/error-state/error-state.component';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ${Feature}Store } from '../${name}.store';

@Component({
  selector: 'app-${entity}-list-page',
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
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
    `<app-page-header [title]="'${name}.title' | tr: {} : '${pascal(name)}'">${
      readOnly
        ? ''
        : `
  <a class="button" routerLink="/${name}/new">{{ '${name}.new' | tr: {} : 'New ${entity}' }}</a>`
    }
</app-page-header>

<form class="search-bar" (ngSubmit)="searchItems()">
  <label class="visually-hidden" for="${name}-search">{{
    '${name}.search' | tr: {} : 'Search ${name}'
  }}</label>
  <input
    id="${name}-search"
    name="search"
    type="search"
    [ngModel]="search()"
    (ngModelChange)="search.set($event)"
  />
  <button class="button" type="submit">{{ '${name}.searchButton' | tr: {} : 'Search' }}</button>
</form>

@if (store.state(); as state) {
  @if (state.status === 'error') {
    <app-error-state
      [message]="'${name}.loadError' | tr: {} : 'The ${name} could not be loaded. Please try again.'"
      [retryLabel]="'common.retry' | tr: {} : 'Try again'"
      (retry)="store.load()"
    />
  } @else if (state.status === 'loading') {
    <p role="status" class="muted">{{ '${name}.loading' | tr: {} : 'Loading…' }}</p>
  } @else if (state.result && state.result.items.length > 0) {
    <table class="${name}-table">
      <caption class="visually-hidden">
        {{ '${name}.title' | tr: {} : '${pascal(name)}' }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ '${name}.colTitle' | tr: {} : 'Title' }}</th>
          <th scope="col">{{ '${name}.colCreated' | tr: {} : 'Created' }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of state.result.items; track item.id) {
          <tr>
            <td>
              <a [routerLink]="['/${name}', item.id]">{{ item.title }}</a>
            </td>
            <td>{{ item.createdAt }}</td>
          </tr>
        }
      </tbody>
    </table>

    <nav class="pagination" [attr.aria-label]="'${name}.title' | tr: {} : '${pascal(name)}'">
      <button
        class="button button--secondary"
        type="button"
        [disabled]="!state.result.hasPreviousPage"
        (click)="store.goToPage(state.result.pageNumber - 1)"
      >
        {{ '${name}.previous' | tr: {} : 'Previous' }}
      </button>
      <span class="muted">{{
        '${name}.pagination'
          | tr: { page: state.result.pageNumber, total: state.result.totalPages } : 'Page {page} of {total}'
      }}</span>
      <button
        class="button button--secondary"
        type="button"
        [disabled]="!state.result.hasNextPage"
        (click)="store.goToPage(state.result.pageNumber + 1)"
      >
        {{ '${name}.next' | tr: {} : 'Next' }}
      </button>
    </nav>
  } @else {
    <app-empty-state [message]="'${name}.empty' | tr: {} : 'No ${name} found.'" />
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
    max-width: 380px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font: inherit;
  }
}

.${name}-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;

  th,
  td {
    text-align: left;
    padding: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  a {
    font-weight: 600;
    text-decoration: none;
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
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import type { ${Entity}Details } from '../data-access/${name}.models';
import { ${TOKEN}_REPOSITORY, ${Entity}NotFoundError } from '../data-access/${entity}.repository';

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-${entity}-detail-page',
  imports: [RouterLink, TranslatePipe, PageHeaderComponent],
  templateUrl: './${entity}-detail-page.component.html',
  styleUrl: './${entity}-detail-page.component.scss'
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
    `${entity}-detail/${entity}-detail-page.component.html`,
    `@if (status() === 'loading') {
  <p role="status" class="muted">{{ '${name}.loading' | tr: {} : 'Loading…' }}</p>
} @else if (status() === 'not-found') {
  <section class="card">
    <h1>{{ '${name}.notFoundTitle' | tr: {} : '${Title} not found' }}</h1>
    <a class="button" routerLink="/${name}">{{ 'common.back' | tr: {} : 'Back' }}</a>
  </section>
} @else if (item(); as selected) {
  <app-page-header [title]="selected.title">${
    readOnly
      ? ''
      : `
    <a class="button" [routerLink]="['/${name}', selected.id, 'edit']">
      {{ '${name}.edit' | tr: {} : 'Edit' }}
    </a>`
  }
    <a routerLink="/${name}">{{ 'common.back' | tr: {} : 'Back' }}</a>
  </app-page-header>

  <section class="card">
    <p>{{ selected.description }}</p>
    <p class="muted">{{ '${name}.createdAt' | tr: {} : 'Created' }}: {{ selected.createdAt }}</p>
  </section>
} @else {
  <section class="card">
    <div class="error-banner" role="alert">
      {{ '${name}.loadError' | tr: {} : 'The ${entity} could not be loaded.' }}
    </div>
    <a class="button" routerLink="/${name}">{{ 'common.back' | tr: {} : 'Back' }}</a>
  </section>
}
`,
  );

  F(
    `${entity}-detail/${entity}-detail-page.component.scss`,
    `.card {
  max-width: 720px;
}
`,
  );

  if (!readOnly) {
    F(
      `${entity}-form.store.ts`,
      `import { computed, inject, Injectable, signal } from '@angular/core';
import { isApiError } from '../../core/http/api-error';
import { TRANSLATION } from '../../shared/i18n/translation.port';
import type { ${Entity}Details, ${Entity}Input } from './data-access/${name}.models';
import {
  ${TOKEN}_REPOSITORY,
  ${Entity}ConflictError,
  ${Entity}NotFoundError
} from './data-access/${entity}.repository';

export type FormStatus = 'idle' | 'loading' | 'saving';

const GENERIC_SAVE_ERROR = 'The ${entity} could not be saved. Please try again.';
const GENERIC_LOAD_ERROR = 'The ${entity} could not be loaded. Please try again.';

/**
 * Feature-scoped state for the create/edit form. Split deliberately from
 * \`${Feature}Store\` (list state) so the two route scopes never share mutable
 * state, and so server validation errors can be surfaced to the form owner.
 */
@Injectable()
export class ${Entity}FormStore {
  private readonly repository = inject(${TOKEN}_REPOSITORY);
  private readonly translation = inject(TRANSLATION, { optional: true });

  private readonly _status = signal<FormStatus>('idle');
  readonly status = this._status.asReadonly();

  private readonly _item = signal<${Entity}Details | null>(null);
  readonly item = this._item.asReadonly();

  private readonly _loadError = signal<string | null>(null);
  readonly loadError = this._loadError.asReadonly();

  private readonly _saveError = signal<string | null>(null);
  readonly saveError = this._saveError.asReadonly();

  private readonly _notFound = signal(false);
  readonly notFound = this._notFound.asReadonly();

  private readonly _serverError = signal<import('../../core/http/api-error').ApiError | null>(null);
  readonly serverError = this._serverError.asReadonly();

  readonly isSaving = computed(() => this._status() === 'saving');

  async load(id: string): Promise<void> {
    this._status.set('loading');
    this._loadError.set(null);
    this._notFound.set(false);

    try {
      this._item.set(await this.repository.findById(id));
    } catch (error) {
      if (error instanceof ${Entity}NotFoundError) {
        this._notFound.set(true);
      } else {
        this._loadError.set(this.toLoadMessage(error));
      }
    } finally {
      this._status.set('idle');
    }
  }

  async save(id: string | null, input: ${Entity}Input): Promise<${Entity}Details | null> {
    this._status.set('saving');
    this._saveError.set(null);
    this._serverError.set(null);

    try {
      const saved = id
        ? await this.repository.update(id, input)
        : await this.repository.create(input);
      this._item.set(saved);
      return saved;
    } catch (error) {
      if (isApiError(error) && Object.keys(error.validationErrors).length > 0) {
        this._serverError.set(error);
      }
      this._saveError.set(this.toSaveMessage(error));
      return null;
    } finally {
      this._status.set('idle');
    }
  }

  private toSaveMessage(error: unknown): string {
    if (error instanceof ${Entity}ConflictError) {
      return this.translate('${name}.errors.conflict', 'A ${entity} with this title already exists.');
    }
    if (error instanceof ${Entity}NotFoundError) {
      return this.translate('${name}.errors.notFound', 'This ${entity} no longer exists.');
    }
    if (isApiError(error)) {
      // The error interceptor localizes/sanitizes ApiError.message already.
      return error.message;
    }
    return this.translate('${name}.errors.save', GENERIC_SAVE_ERROR);
  }

  private toLoadMessage(error: unknown): string {
    return isApiError(error)
      ? error.message
      : this.translate('${name}.errors.load', GENERIC_LOAD_ERROR);
  }

  private translate(key: string, fallback: string): string {
    return this.translation?.translate(key, undefined, fallback) ?? fallback;
  }
}
`,
    );

    F(
      `${entity}-form/${entity}-form-page.component.ts`,
      `import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { applyServerValidationErrors } from '../../../core/http/server-validation.mapper';
import { PendingChanges } from '../../../core/guards/unsaved-changes.guard';
import { NotificationService } from '../../../core/services/notification.service';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';
import { FieldErrorComponent } from '../../../shared/forms/field-error.component';
import { trimmedRequired } from '../../../shared/forms/validators';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';
import { TRANSLATION } from '../../../shared/i18n/translation.port';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { ${Entity}FormStore } from '../${entity}-form.store';
import type { ${Entity}Input } from '../data-access/${name}.models';

type FieldName = 'title' | 'description';

/**
 * Create/edit ${entity} form. One component, two routes (\`/${name}/new\` and
 * \`/${name}/:id/edit\`): the presence of an :id param selects edit mode.
 */
@Component({
  selector: 'app-${entity}-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AutofocusDirective,
    FieldErrorComponent,
    TranslatePipe,
    PageHeaderComponent
  ],
  templateUrl: './${entity}-form-page.component.html',
  styleUrl: './${entity}-form-page.component.scss'
})
export class ${Entity}FormPageComponent implements PendingChanges {
  private readonly store = inject(${Entity}FormStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly translations = inject(TRANSLATION, { optional: true });

  protected readonly editingId = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.editingId() !== null);
  protected readonly status = this.store.status;
  protected readonly isSaving = this.store.isSaving;
  protected readonly loadError = this.store.loadError;
  protected readonly saveError = this.store.saveError;
  protected readonly notFound = this.store.notFound;
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [trimmedRequired(), Validators.maxLength(120)]],
    description: ['', Validators.maxLength(1000)]
  });

  private baseline = JSON.stringify(this.form.getRawValue());
  private saved = false;

  constructor() {
    void this.init(this.route.snapshot.paramMap.get('id'));
  }

  private async init(id: string | null): Promise<void> {
    if (id) {
      this.editingId.set(id);
      await this.store.load(id);
      const item = this.store.item();
      if (item) {
        this.form.patchValue({ title: item.title, description: item.description });
        this.form.markAsPristine();
      }
    }
    this.baseline = JSON.stringify(this.form.getRawValue());
  }

  /** Used by unsavedChangesGuard to veto navigation away from dirty edits. */
  hasUnsavedChanges(): boolean {
    return !this.saved && JSON.stringify(this.form.getRawValue()) !== this.baseline;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const id = this.editingId();
    const saved = await this.store.save(id, this.toInput());

    if (!saved) {
      const serverError = this.store.serverError();
      if (serverError) {
        applyServerValidationErrors(this.form, serverError);
      }
      return;
    }

    this.saved = true;
    this.notifications.success(
      id
        ? this.translation('${name}.savedUpdated', '${Entity} updated.')
        : this.translation('${name}.savedCreated', '${Entity} created.')
    );
    await this.router.navigate(['/${name}', saved.id]);
  }

  protected retryLoad(): void {
    const id = this.editingId();
    if (id) {
      void this.init(id);
    }
  }

  protected isInvalid(field: FieldName): boolean {
    return this.form.controls[field].invalid;
  }

  protected shouldShowFieldError(field: FieldName): boolean {
    const control = this.form.controls[field];
    return (this.submitted() || control.touched) && control.invalid;
  }

  private toInput(): ${Entity}Input {
    const raw = this.form.getRawValue();
    return {
      title: raw.title.trim(),
      description: raw.description.trim()
    };
  }

  private translation(key: string, fallback: string): string {
    return this.translations?.translate(key, undefined, fallback) ?? fallback;
  }
}
`,
    );

    F(
      `${entity}-form/${entity}-form-page.component.html`,
      `@if (status() === 'loading') {
  <p role="status" aria-live="polite" class="muted">
    {{ '${name}.loadingDetail' | tr: {} : 'Loading…' }}
  </p>
} @else if (notFound()) {
  <section class="card">
    <h1>{{ '${name}.notFoundTitle' | tr: {} : '${Title} not found' }}</h1>
    <a class="button" routerLink="/${name}">{{ 'common.back' | tr: {} : 'Back' }}</a>
  </section>
} @else if (loadError(); as message) {
  <section class="card">
    <div class="error-banner" role="alert">{{ message }}</div>
    <button type="button" class="button button--secondary" (click)="retryLoad()">
      {{ 'common.retry' | tr: {} : 'Try again' }}
    </button>
  </section>
} @else {
  <app-page-header
    [title]="
      (isEdit() ? '${name}.editTitle' : '${name}.newTitle')
        | tr: { title: form.controls.title.value } : '${Entity}'
    "
  >
    <a class="button button--secondary" routerLink="/${name}">{{ 'common.cancel' | tr: {} : 'Cancel' }}</a>
  </app-page-header>

  @if (saveError(); as message) {
    <div class="error-banner" role="alert">{{ message }}</div>
  }

  <form class="card ${entity}-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
    <div class="field">
      <label for="title">{{ '${name}.formTitle' | tr: {} : 'Title' }}</label>
      <input
        id="title"
        formControlName="title"
        type="text"
        [attr.aria-invalid]="isInvalid('title')"
        aria-describedby="title-errors"
        [appAutofocus]="true"
      />
      <app-field-error
        id="title-errors"
        [control]="form.controls.title"
        [show]="shouldShowFieldError('title')"
        [label]="'${name}.formTitle' | tr: {} : 'Title'"
      />
    </div>

    <div class="field">
      <label for="description">{{ '${name}.formDescription' | tr: {} : 'Description' }}</label>
      <textarea
        id="description"
        formControlName="description"
        rows="4"
        [attr.aria-invalid]="isInvalid('description')"
        aria-describedby="description-errors"
      ></textarea>
      <app-field-error
        id="description-errors"
        [control]="form.controls.description"
        [show]="shouldShowFieldError('description')"
        [label]="'${name}.formDescription' | tr: {} : 'Description'"
      />
    </div>

    <div class="form-actions">
      <button class="button" type="submit" [disabled]="isSaving()">
        {{ (isSaving() ? '${name}.saving' : '${name}.save') | tr: {} : 'Save' }}
      </button>
      <a class="button button--secondary" routerLink="/${name}">{{ 'common.cancel' | tr: {} : 'Cancel' }}</a>
    </div>
  </form>
}
`,
    );

    F(
      `${entity}-form/${entity}-form-page.component.scss`,
      `.${entity}-form {
  max-width: 640px;
}

.form-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
`,
    );
  }

  if (readOnly) {
    F(
      `${name}.routes.ts`,
      `import { Routes } from '@angular/router';
import { ${Entity}DetailPageComponent } from './${entity}-detail/${entity}-detail-page.component';
import { ${Entity}ListPageComponent } from './${entity}-list/${entity}-list-page.component';
import { ${camel(name)}DataAccessProviders } from './data-access/${name}-data-access.providers';
import { ${Feature}Store } from './${name}.store';

/**
 * Feature-scoped data-access wiring lives in
 * data-access/${name}-data-access.providers.ts.
 */
export const ${screaming(name)}_ROUTES: Routes = [
  {
    path: '',
    component: ${Entity}ListPageComponent,
    providers: [...${camel(name)}DataAccessProviders, ${Feature}Store]
  },
  {
    path: ':id',
    component: ${Entity}DetailPageComponent,
    providers: [...${camel(name)}DataAccessProviders]
  }
];
`,
    );
  } else {
    F(
      `${name}.routes.ts`,
      `import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '../../core/guards/unsaved-changes.guard';
import { ${Entity}FormPageComponent } from './${entity}-form/${entity}-form-page.component';
import { ${Entity}FormStore } from './${entity}-form.store';
import { ${Entity}DetailPageComponent } from './${entity}-detail/${entity}-detail-page.component';
import { ${Entity}ListPageComponent } from './${entity}-list/${entity}-list-page.component';
import { ${camel(name)}DataAccessProviders } from './data-access/${name}-data-access.providers';
import { ${Feature}Store } from './${name}.store';

/**
 * Feature-scoped data-access wiring lives in
 * data-access/${name}-data-access.providers.ts.
 */
export const ${screaming(name)}_ROUTES: Routes = [
  {
    path: '',
    component: ${Entity}ListPageComponent,
    providers: [...${camel(name)}DataAccessProviders, ${Feature}Store]
  },
  {
    path: 'new',
    component: ${Entity}FormPageComponent,
    canDeactivate: [unsavedChangesGuard],
    providers: [...${camel(name)}DataAccessProviders, ${Entity}FormStore]
  },
  {
    path: ':id/edit',
    component: ${Entity}FormPageComponent,
    canDeactivate: [unsavedChangesGuard],
    providers: [...${camel(name)}DataAccessProviders, ${Entity}FormStore]
  },
  {
    path: ':id',
    component: ${Entity}DetailPageComponent,
    providers: [...${camel(name)}DataAccessProviders]
  }
];
`,
    );
  }

  F(
    `data-access/in-memory-${entity}.repository.spec.ts`,
    readOnly
      ? `import { InMemory${Entity}Repository } from './in-memory-${entity}.repository';
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
`
      : `import { InMemory${Entity}Repository, resetInMemory${Entity}s } from './in-memory-${entity}.repository';
import { ${Entity}ConflictError, ${Entity}NotFoundError } from './${entity}.repository';

describe('InMemory${Entity}Repository (generated)', () => {
  let repository: InMemory${Entity}Repository;

  beforeEach(() => {
    resetInMemory${Entity}s();
    repository = new InMemory${Entity}Repository();
  });

  it('creates a record and finds it by id', async () => {
    const created = await repository.create({ title: 'Brand new ${entity}', description: 'Body' });

    await expectAsync(repository.findById(created.id)).toBeResolvedTo(created);
  });

  it('rejects a duplicate title with ${Entity}ConflictError', async () => {
    await repository.create({ title: 'Duplicate ${entity}', description: 'First' });

    await expectAsync(
      repository.create({ title: 'Duplicate ${entity}', description: 'Second' })
    ).toBeRejectedWithError(${Entity}ConflictError);
  });

  it('updates an existing record', async () => {
    const created = await repository.create({ title: 'Before', description: 'Body' });
    const updated = await repository.update(created.id, { title: 'After', description: 'Body' });

    expect(updated.title).toBe('After');
    await expectAsync(repository.findById(created.id)).toBeResolvedTo(updated);
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
  const { name, withWorkflow, readOnly } = parseFeatureArgs(args);
  const featureDir = join(root, 'src', 'app', 'features', name);
  const appRoutesPath = join(root, 'src', 'app', 'app.routes.ts');
  const eslintPath = join(root, 'eslint.config.mjs');
  const angularPath = join(root, 'angular.json');

  if (existsSync(featureDir)) {
    throw new GeneratorError(
      `Feature "${name}" already exists at src/app/features/${name}. No changes were made.`,
    );
  }

  // ---- preflight: everything validated before any write ----
  if (!existsSync(appRoutesPath)) throw new GeneratorError('src/app/app.routes.ts is missing.');
  if (!existsSync(eslintPath)) throw new GeneratorError('eslint.config.mjs is missing.');
  if (!existsSync(angularPath)) throw new GeneratorError('angular.json is missing.');
  const appRoutesSource = readFileSync(appRoutesPath, 'utf8');
  const eslintSource = readFileSync(eslintPath, 'utf8');
  const angularSource = readFileSync(angularPath, 'utf8');

  if (appRoutesSource.includes(`'./features/${name}/${name}.routes'`)) {
    throw new GeneratorError(`app.routes.ts already references feature "${name}".`);
  }
  if (eslintSource.includes(`'./features/${name}'`)) {
    throw new GeneratorError(`eslint.config.mjs already has a boundary zone for "${name}".`);
  }

  const appRouteLine = findMarkerLine(appRoutesSource, APP_ROUTE_MARKER);
  const eslintMarkerLine = findMarkerLine(eslintSource, ESLINT_MARKER);
  const { entity, Entity, Feature, TOKEN, files } = buildFeatureFiles(name, withWorkflow, readOnly);

  const patchedRoutes = spliceAtLine(appRoutesSource, appRouteLine, routeSnippetLines(name));
  const patchedEslint = spliceAtLine(eslintSource, eslintMarkerLine, zoneSnippetLines(name));
  const patchedAngular = patchAngularJson(angularSource, name);

  // ---- apply (transactional) ----
  const tx = new Transaction([featureDir]);
  const runTool = makeToolRunner(ctx);
  try {
    tx.patchFile(appRoutesPath, patchedRoutes);
    tx.patchFile(eslintPath, patchedEslint);
    tx.patchFile(angularPath, patchedAngular);
    for (const [rel, content] of files) tx.writeFile(join(featureDir, rel), content);

    runTool('prettier', [
      '--write',
      ...files.map(([rel]) => toPosix(root, join(featureDir, rel))),
      'src/app/app.routes.ts',
      'eslint.config.mjs',
      'angular.json',
    ]);
    verify(ctx, runTool);
    tx.commit();
  } catch (error) {
    const problems = tx.rollback();
    throw new GeneratorError(
      `${error.message}\nWorkspace rolled back.${problems.length ? ` ROLLBACK INCOMPLETE: ${problems.join('; ')}` : ''}`,
    );
  }

  const mode = readOnly ? 'read-only' : 'crud';
  log(
    `Created feature "${name}" (${files.length} files, ${mode} mode${withWorkflow ? ', domain workflow' : ''}).`,
  );
  log(
    'Lazy route + ESLint boundary zone + angular.json production wiring added; all gates passed.',
  );
  log('\nNext steps:');
  log(`  1. Replace seed data and the sample fields in src/app/features/${name}.`);
  log(
    `  2. Tune the inline fallback copy or add "${name}.*" keys to src/app/core/i18n/locale-catalog.ts.`,
  );
  log(
    `  3. Protect routes with permissionGuard — register the permission in core/authorization/app-permissions.ts.`,
  );
  log(
    `  4. Point ${entity}-http.repository.ts at your backend (docs/recipes/backend-cutover.md); the production provider already uses it.`,
  );
  return { feature: name, entity, Entity, Feature, TOKEN, mode };
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
        'Usage:\n  node scripts/generate.mjs feature <name> [--read-only] [--workflow]\n  node scripts/generate.mjs page <feature> <pageName>',
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
