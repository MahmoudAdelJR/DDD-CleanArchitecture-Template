import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StructuredConsoleLogger } from './structured-console.logger';

interface CapturedLine {
  level: string;
  msg: string;
  ctx?: Record<string, unknown>;
}

describe('StructuredConsoleLogger', () => {
  let lines: CapturedLine[];
  let logger: StructuredConsoleLogger;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), StructuredConsoleLogger],
    });
    logger = TestBed.inject(StructuredConsoleLogger);

    lines = [];
    spyOn(console, 'info').and.callFake((line: string) => lines.push(JSON.parse(line)));
    spyOn(console, 'warn').and.callFake((line: string) => lines.push(JSON.parse(line)));
    spyOn(console, 'error').and.callFake((line: string) => lines.push(JSON.parse(line)));
  });

  it('writes structured JSON records with level and timestamp', () => {
    logger.info('customers loaded', { count: 5 });

    expect(lines.length).toBe(1);
    expect(lines[0].level).toBe('info');
    expect(lines[0].msg).toBe('customers loaded');
    expect(lines[0].ctx).toEqual({ count: 5 });
    expect(Date.parse((lines[0] as unknown as { ts: string }).ts)).toBeGreaterThan(0);
  });

  it('redacts secret-looking keys at any depth', () => {
    logger.error('login failed', {
      accessToken: 'super-secret',
      nested: { refreshToken: 'r', email: 'a@b.c' },
    });

    const ctx = lines[0].ctx as {
      accessToken: string;
      nested: { refreshToken: string; email: string };
    };
    expect(ctx.accessToken).toBe('[redacted]');
    expect(ctx.nested.refreshToken).toBe('[redacted]');
    expect(ctx.nested.email).toBe('a@b.c');
  });

  it('serializes Error objects without leaking stacks', () => {
    logger.error('operation failed', { cause: new TypeError('bad input') });

    const ctx = lines[0].ctx as { cause: { name: string; message: string } };
    expect(ctx.cause).toEqual({ name: 'TypeError', message: 'bad input' });
  });

  it('bounds recursion depth', () => {
    logger.warn('deep', { a: { b: { c: { d: { e: { f: 'far' } } } } } });

    expect(lines[0].msg).toBe('deep');
    expect(JSON.stringify(lines[0].ctx)).toContain('max-depth');
  });
});
