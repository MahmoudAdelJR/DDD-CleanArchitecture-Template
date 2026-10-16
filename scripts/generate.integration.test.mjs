/**
 * Integration tests for scripts/generate.mjs and scripts/check-architecture.mjs.
 *
 * Run with: npm run test:generator
 *
 * Every scenario operates on a throwaway workspace under os.tmpdir() (never
 * the repository) with an injected command runner, so nothing mutates git.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import { defaultRunCommand, runGenerator } from './generate.mjs';
import { checkArchitecture } from './check-architecture.mjs';

const APP_ROUTES_TEMPLATE = `import { Routes } from '@angular/router';

export const ROUTES: Routes = [
      // gen:app-route — npm run gen:feature inserts new lazy feature routes here
];
`;

const ESLINT_TEMPLATE = `export default [
  {
    rules: {
      'import/no-restricted-paths': ['error', {
        zones: [
            // gen:feature-zones — npm run gen:feature inserts new cross-feature zones here
        ],
      }],
    },
  },
];
`;

const cleanupRoots = [];

function fixtureWorkspace({
  routes = APP_ROUTES_TEMPLATE,
  eslint = ESLINT_TEMPLATE,
  extraFiles = {},
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gen test '));
  cleanupRoots.push(root);
  mkdirSync(join(root, 'src', 'app'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'app.routes.ts'), routes, 'utf8');
  writeFileSync(join(root, 'eslint.config.mjs'), eslint, 'utf8');
  for (const [rel, content] of Object.entries(extraFiles)) {
    const target = join(root, rel);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content, 'utf8');
  }
  return root;
}

function fakeRunner(failOnTool = null) {
  const calls = [];
  return {
    calls,
    runCommand: (script, args) => {
      const tool = basename(script);
      calls.push([tool, args]);
      if (failOnTool && tool === failOnTool) {
        return { status: 1, stdout: 'controlled failure output', stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
  };
}

function quietGenerator(root, runner, argv) {
  return runGenerator({ argv, root, runCommand: runner.runCommand, log: () => {} });
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function routesArrayPaths(source) {
  const sf = ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true);
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const decl = statement.declarationList.declarations[0];
    if (decl?.initializer && ts.isArrayLiteralExpression(decl.initializer)) {
      return decl.initializer.elements.map((el) => {
        assert.ok(
          ts.isObjectLiteralExpression(el),
          'every route element must be an object literal',
        );
        const pathProp = el.properties.find((p) => {
          if (!ts.isPropertyAssignment(p)) return false;
          const n = p.name;
          return (ts.isStringLiteral(n) ? n.text : n.getText(sf)) === 'path';
        });
        return pathProp.initializer.getText(sf).replaceAll("'", '');
      });
    }
  }
  assert.fail('no Routes array found in generated output');
}

after(() => {
  for (const root of cleanupRoots) rmSync(root, { recursive: true, force: true });
});

describe('gen:feature (success paths)', () => {
  test('creates the slice, wires route + zone exactly once, verifies in order', () => {
    const root = fixtureWorkspace();
    const runner = fakeRunner();

    quietGenerator(root, runner, ['feature', 'orders']);

    assert.ok(existsSync(join(root, 'src/app/features/orders/orders.routes.ts')));
    assert.ok(existsSync(join(root, 'src/app/features/orders/data-access/order.repository.ts')));
    assert.ok(
      existsSync(join(root, 'src/app/features/orders/order-list/order-list-page.component.html')),
    );
    assert.ok(!existsSync(join(root, 'src/app/features/orders/domain')));

    const routes = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');
    const eslint = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');
    assert.equal(countOccurrences(routes, `'./features/orders/orders.routes'`), 1);
    assert.equal(countOccurrences(eslint, `target: './features/orders'`), 1);

    assert.deepEqual(
      runner.calls.map(([tool]) => tool),
      ['prettier.cjs', 'check-architecture.mjs', 'tsc', 'eslint.js', 'ng.js'],
    );
    const prettierArgs = runner.calls[0][1];
    assert.equal(prettierArgs[0], '--write');
    assert.ok(prettierArgs.includes('src/app/features/orders/orders.routes.ts'));
    assert.ok(prettierArgs.includes('src/app/app.routes.ts'));
    assert.ok(prettierArgs.includes('eslint.config.mjs'));
  });

  test('--workflow adds the domain module and its spec', () => {
    const root = fixtureWorkspace();
    quietGenerator(root, fakeRunner(), ['feature', 'invoices', '--workflow']);

    assert.ok(existsSync(join(root, 'src/app/features/invoices/domain/invoice.ts')));
    assert.ok(existsSync(join(root, 'src/app/features/invoices/domain/invoice.spec.ts')));
  });
});

describe('gen:feature (preflight rejections: nothing is written)', () => {
  test('rejects raw non-kebab input without touching the workspace', () => {
    const root = fixtureWorkspace();
    const before = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');

    assert.throws(() => quietGenerator(root, fakeRunner(), ['feature', 'Orders']), /kebab-case/u);

    assert.equal(readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8'), before);
    assert.ok(!existsSync(join(root, 'src/app/features/Orders')));
    assert.ok(!existsSync(join(root, 'src/app/features/orders')));
  });

  test('rejects unknown flags and extra positional arguments', () => {
    const root = fixtureWorkspace();
    assert.throws(
      () =>
        runGenerator({
          argv: ['feature', 'orders', '--turbo'],
          root,
          runCommand: fakeRunner().runCommand,
          log: () => {},
        }),
      /Unknown flag/u,
    );
    assert.throws(
      () =>
        runGenerator({
          argv: ['feature', 'orders', 'extra'],
          root,
          runCommand: fakeRunner().runCommand,
          log: () => {},
        }),
      /exactly one feature name/u,
    );
  });

  test('missing marker aborts before creating anything', () => {
    const root = fixtureWorkspace({ routes: 'export const ROUTES = [];\n' });
    assert.throws(
      () => quietGenerator(root, fakeRunner(), ['feature', 'orders']),
      /Marker .*gen:app-route.* not found/u,
    );
    assert.ok(!existsSync(join(root, 'src/app/features/orders')));
  });

  test('duplicate marker aborts (ambiguous insertion point)', () => {
    const root = fixtureWorkspace({ routes: `${APP_ROUTES_TEMPLATE}// gen:app-route — second\n` });
    assert.throws(() => quietGenerator(root, fakeRunner(), ['feature', 'orders']), /exactly once/u);
    assert.ok(!existsSync(join(root, 'src/app/features/orders')));
  });

  test('existing feature directory is refused without changes', () => {
    const root = fixtureWorkspace({ extraFiles: { 'src/app/features/orders/keep.txt': 'x' } });
    const before = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');
    assert.throws(
      () => quietGenerator(root, fakeRunner(), ['feature', 'orders']),
      /already exists at src\/app\/features/u,
    );
    assert.equal(readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8'), before);
  });
});

describe('gen:feature (automatic rollback)', () => {
  function assertPristine(root, routesBefore, eslintBefore) {
    assert.ok(!existsSync(join(root, 'src/app/features/orders')));
    assert.equal(readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8'), routesBefore);
    assert.equal(readFileSync(join(root, 'eslint.config.mjs'), 'utf8'), eslintBefore);
  }

  test('lint failure during verification restores the exact prior state', () => {
    const root = fixtureWorkspace();
    const routesBefore = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');
    const eslintBefore = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');

    assert.throws(
      () => quietGenerator(root, fakeRunner('eslint.js'), ['feature', 'orders']),
      /Verification step FAILED/u,
    );
    assertPristine(root, routesBefore, eslintBefore);
  });

  test('prettier failure restores the exact prior state', () => {
    const root = fixtureWorkspace();
    const routesBefore = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');
    const eslintBefore = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');

    assert.throws(
      () => quietGenerator(root, fakeRunner('prettier.cjs'), ['feature', 'orders']),
      /FAILED/u,
    );
    assertPristine(root, routesBefore, eslintBefore);
  });

  test('unit-test failure restores the exact prior state', () => {
    const root = fixtureWorkspace();
    const routesBefore = readFileSync(join(root, 'src/app/app.routes.ts'), 'utf8');
    const eslintBefore = readFileSync(join(root, 'eslint.config.mjs'), 'utf8');

    assert.throws(
      () => quietGenerator(root, fakeRunner('ng.js'), ['feature', 'orders']),
      /FAILED/u,
    );
    assertPristine(root, routesBefore, eslintBefore);
  });

  test('rollback message distinguishes clean rollback from incomplete rollback', () => {
    const root = fixtureWorkspace();
    try {
      quietGenerator(root, fakeRunner('tsc'), ['feature', 'orders']);
      assert.fail('expected failure');
    } catch (error) {
      assert.match(error.message, /Workspace rolled back\.$/u);
    }
  });
});

describe('gen:page', () => {
  const multilineRoutes = `import { Provider } from '@angular/core';
import { Routes } from '@angular/router';
import { TaskDetailPageComponent } from './task-detail/task-detail-page.component';
import { TaskListPageComponent } from './task-list/task-list-page.component';

export const TASKS_ROUTES: Routes = [
  {
    path: '',
    component: TaskListPageComponent,
    providers: [TaskStore],
  },
  {
    path: ':id',
    component: TaskDetailPageComponent,
  },
];
`;

  const oneLineRoutes = `import { Routes } from '@angular/router';
import { ProfilePageComponent } from './profile/profile-page.component';

export const IDENTITY_ROUTES: Routes = [{ path: '', component: ProfilePageComponent }];
`;

  function pageFixture(source = multilineRoutes, feature = 'tasks') {
    return fixtureWorkspace({
      extraFiles: { [`src/app/features/${feature}/${feature}.routes.ts`]: source },
    });
  }

  test('inserts static page route BEFORE the :id route (valid TS)', () => {
    const root = pageFixture();
    quietGenerator(root, fakeRunner(), ['page', 'tasks', 'archive']);

    const after = readFileSync(join(root, 'src/app/features/tasks/tasks.routes.ts'), 'utf8');
    const paths = routesArrayPaths(after);
    assert.deepEqual(paths, ['', 'archive', ':id']);
    assert.ok(
      existsSync(join(root, 'src/app/features/tasks/archive-page/archive-page.component.ts')),
    );
  });

  test('one-line Routes arrays are patched INSIDE the array (regression)', () => {
    const root = pageFixture(oneLineRoutes, 'identity');
    quietGenerator(root, fakeRunner(), ['page', 'identity', 'archive']);

    const after = readFileSync(join(root, 'src/app/features/identity/identity.routes.ts'), 'utf8');
    assert.deepEqual(routesArrayPaths(after), ['', 'archive']);
  });

  test('rejects duplicate route paths before writing', () => {
    const root = pageFixture(multilineRoutes.replace("path: ''", "path: 'archive'"));
    const before = readFileSync(join(root, 'src/app/features/tasks/tasks.routes.ts'), 'utf8');

    assert.throws(
      () => quietGenerator(root, fakeRunner(), ['page', 'tasks', 'archive']),
      /already exists in tasks\.routes\.ts/u,
    );
    assert.equal(
      readFileSync(join(root, 'src/app/features/tasks/tasks.routes.ts'), 'utf8'),
      before,
    );
    assert.ok(!existsSync(join(root, 'src/app/features/tasks/archive-page')));
  });

  test('unknown feature, extra flags, and bad names are rejected', () => {
    const root = fixtureWorkspace();
    assert.throws(
      () => quietGenerator(root, fakeRunner(), ['page', 'ghost', 'list']),
      /does not exist/u,
    );

    const tasks = pageFixture();
    assert.throws(
      () =>
        runGenerator({
          argv: ['page', 'tasks', 'archive', '--quick'],
          root: tasks,
          runCommand: fakeRunner().runCommand,
          log: () => {},
        }),
      /no flags/u,
    );
    assert.throws(
      () =>
        runGenerator({
          argv: ['page', 'Tasks', 'archive'],
          root: tasks,
          runCommand: fakeRunner().runCommand,
          log: () => {},
        }),
      /kebab-case/u,
    );
  });

  test('verification failure rolls the page + route wiring back exactly', () => {
    const root = pageFixture();
    const before = readFileSync(join(root, 'src/app/features/tasks/tasks.routes.ts'), 'utf8');

    assert.throws(
      () => quietGenerator(root, fakeRunner('eslint.js'), ['page', 'tasks', 'archive']),
      /FAILED/u,
    );
    assert.equal(
      readFileSync(join(root, 'src/app/features/tasks/tasks.routes.ts'), 'utf8'),
      before,
    );
    assert.ok(!existsSync(join(root, 'src/app/features/tasks/archive-page')));
  });
});

describe('defaultRunCommand (no shell)', () => {
  test('passes arguments verbatim (spaces + shell metacharacters) with no DEP0190', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runner test '));
    cleanupRoots.push(dir);
    const probe = join(dir, 'probe.mjs');
    writeFileSync(probe, 'process.stdout.write(JSON.stringify(process.argv.slice(2)));', 'utf8');

    const args = ['a b', 'x&y|z', '$HOME', '`whoami`'];
    const result = defaultRunCommand(probe, args, dir);

    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), args);
    assert.ok(!result.stderr.includes('DEP0190'), 'no DEP0190 deprecation warning');
  });
});

describe('checkArchitecture', () => {
  const routesWith = (pairs) =>
    `const routes = [
${pairs.map(([f, file]) => `  { path: '${f}', loadChildren: () => import('./features/${f}/${file}').then((m) => m.X) },`).join('\n')}
];
`;
  const eslintWith = (targets) =>
    `const zones = [
${targets.map((t) => `  { target: './features/${t}', from: './features' },`).join('\n')}
];
`;

  function archWorkspace({ features, zones, imports } = {}) {
    const extraFiles = {};
    for (const f of features ?? ['auth']) {
      extraFiles[`src/app/features/${f}/${f}.routes.ts`] = 'export const R = [];\n';
    }
    if (zones) extraFiles['eslint.config.mjs'] = eslintWith(zones);
    if (imports) extraFiles['src/app/app.routes.ts'] = routesWith(imports);
    return fixtureWorkspace({ extraFiles });
  }

  test('healthy wiring produces no errors', () => {
    const root = archWorkspace({
      features: ['auth'],
      zones: ['auth'],
      imports: [['auth', 'auth.routes']],
    });
    const { errors } = checkArchitecture({ root });
    assert.deepEqual(errors, []);
  });

  test('missing zone is detected', () => {
    const root = archWorkspace({
      features: ['auth'],
      zones: [],
      imports: [['auth', 'auth.routes']],
    });
    const { errors } = checkArchitecture({ root });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /NO cross-feature boundary zone/u);
  });

  test('stale zone (no folder) is detected', () => {
    const root = archWorkspace({
      features: ['auth'],
      zones: ['auth', 'ghost'],
      imports: [['auth', 'auth.routes']],
    });
    const { errors } = checkArchitecture({ root });
    assert.ok(errors.some((e) => /ghost.*does not exist/u.test(e)));
  });

  test('duplicate zone is detected', () => {
    const root = archWorkspace({
      features: ['auth'],
      zones: ['auth', 'auth'],
      imports: [['auth', 'auth.routes']],
    });
    const { errors } = checkArchitecture({ root });
    assert.ok(errors.some((e) => /2 boundary zones/u.test(e)));
  });

  test('lazy import of a nonexistent feature is detected', () => {
    const root = archWorkspace({
      features: ['auth'],
      zones: ['auth'],
      imports: [
        ['auth', 'auth.routes'],
        ['ghost', 'ghost.routes'],
      ],
    });
    const { errors } = checkArchitecture({ root });
    assert.ok(errors.some((e) => /lazily imports feature "ghost"/u.test(e)));
  });

  test('mismatched routes filename is detected', () => {
    const root = archWorkspace({
      features: ['auth'],
      zones: ['auth'],
      imports: [['auth', 'wrong.routes']],
    });
    const { errors } = checkArchitecture({ root });
    assert.ok(errors.some((e) => /expected "auth\.routes"/u.test(e)));
  });

  test('missing <feature>.routes.ts file is detected', () => {
    const root = fixtureWorkspace({
      routes: routesWith([['auth', 'auth.routes']]),
      eslint: eslintWith(['auth']),
    });
    mkdirSync(join(root, 'src/app/features/auth'), { recursive: true });
    const { errors } = checkArchitecture({ root });
    assert.ok(errors.some((e) => /missing its routes file/u.test(e)));
  });
});

describe('GeneratorError hygiene', () => {
  test('unknown command prints usage instead of throwing a bare error', () => {
    const root = fixtureWorkspace();
    assert.throws(
      () =>
        runGenerator({ argv: ['wat'], root, runCommand: fakeRunner().runCommand, log: () => {} }),
      /Usage:/u,
    );
  });
});
