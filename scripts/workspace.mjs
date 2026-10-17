/**
 * Shared workspace tooling for the template's Node scripts:
 * no-shell command execution, local CLI resolution, transactional file
 * editing with exact-state rollback, and a common error type.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export class WorkspaceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export const CLI_ENTRY_POINTS = {
  prettier: join('node_modules', 'prettier', 'bin', 'prettier.cjs'),
  tsc: join('node_modules', 'typescript', 'bin', 'tsc'),
  eslint: join('node_modules', 'eslint', 'bin', 'eslint.js'),
  ng: join('node_modules', '@angular', 'cli', 'bin', 'ng.js'),
};

/** Runs a checked-in Node CLI entry point with NO shell (no DEP0190, no injection). */
export function defaultRunCommand(scriptPath, args, cwd) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
  });
}

/**
 * Executes every touched file as a transaction: existing files are snapshotted
 * byte-for-byte before modification, created files/roots are tracked, and
 * rollback() restores the workspace to its exact prior state.
 */
export class Transaction {
  constructor(createdRoots = []) {
    this.patches = [];
    this.createdFiles = [];
    this.createdRoots = createdRoots.filter((dir) => !existsSync(dir));
    this.committed = false;
  }

  snapshot(path) {
    if (!this.patches.some((patch) => patch.path === path)) {
      const existed = existsSync(path);
      this.patches.push({ path, existed, original: existed ? readFileSync(path) : null });
    }
  }

  patchFile(path, content) {
    this.snapshot(path);
    writeFileSync(path, content, 'utf8');
  }

  writeFile(path, content) {
    if (existsSync(path)) {
      this.patchFile(path, content);
      return;
    }
    mkdirSync(dirname(path), { recursive: true });
    this.createdFiles.push(path);
    writeFileSync(path, content, 'utf8');
  }

  commit() {
    this.committed = true;
  }

  /** Restores the exact prior state; returns a list of rollback problems (if any). */
  rollback() {
    const problems = [];
    for (const patch of this.patches) {
      try {
        if (patch.existed) writeFileSync(patch.path, patch.original, 'utf8');
        else rmSync(patch.path, { force: true });
      } catch (error) {
        problems.push(`restore ${patch.path}: ${error.message}`);
      }
    }
    for (const file of this.createdFiles) {
      try {
        rmSync(file, { force: true });
      } catch (error) {
        problems.push(`delete ${file}: ${error.message}`);
      }
    }
    for (const root of this.createdRoots) {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch (error) {
        problems.push(`remove tree ${root}: ${error.message}`);
      }
    }
    return problems;
  }
}

/** Builds a runTool(tool, args) bound to a { root, runCommand } context. */
export function makeToolRunner(ctx) {
  return function runTool(tool, args) {
    const script =
      tool === 'checkArchitecture'
        ? join(ctx.root, 'scripts', 'check-architecture.mjs')
        : join(ctx.root, CLI_ENTRY_POINTS[tool]);
    const result = ctx.runCommand(script, args, ctx.root);
    const label = `${tool} ${args.join(' ')}`;
    if (result.error) {
      throw new WorkspaceError(`Could not run ${label}: ${result.error.message}`);
    }
    if (result.signal || result.status === null || result.status === undefined) {
      throw new WorkspaceError(
        `${label} was terminated${result.signal ? ` by signal ${result.signal}` : ''}.`,
      );
    }
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
      const tail = output.length > 3000 ? `…(output truncated)…\n${output.slice(-3000)}` : output;
      throw new WorkspaceError(
        `Verification step FAILED: ${label} (exit ${result.status})\n${tail}`,
      );
    }
    return result;
  };
}
