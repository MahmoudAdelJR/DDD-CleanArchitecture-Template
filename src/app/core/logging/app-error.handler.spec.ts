import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LOGGER } from '../../shared/observability/logger.port';
import { LoggerPort } from '../../shared/observability/logger.port';
import { AppErrorHandler } from './app-error.handler';
import { TELEMETRY, TelemetryPort } from '../telemetry/telemetry.port';

describe('AppErrorHandler', () => {
  function setup(): { handler: AppErrorHandler; logger: LoggerPort; telemetry: TelemetryPort } {
    const logger = jasmine.createSpyObj<LoggerPort>('LoggerPort', [
      'debug',
      'info',
      'warn',
      'error',
    ]);
    const telemetry = jasmine.createSpyObj<TelemetryPort>('TelemetryPort', ['reportError']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AppErrorHandler,
        { provide: LOGGER, useValue: logger },
        { provide: TELEMETRY, useValue: telemetry },
      ],
    });

    return { handler: TestBed.inject(AppErrorHandler), logger, telemetry };
  }

  it('logs and reports uncaught errors with structured context', () => {
    const { handler, logger, telemetry } = setup();
    const error = new Error('kaboom');

    handler.handleError(error);

    expect(logger.error).toHaveBeenCalledWith('kaboom', {
      source: 'uncaught',
      error: 'Error: kaboom',
    });
    expect(telemetry.reportError).toHaveBeenCalledWith(error, { kind: 'app-error' });
  });

  it('handles non-error thrown values safely', () => {
    const { handler, logger } = setup();

    handler.handleError('plain string');

    expect(logger.error).toHaveBeenCalledWith('plain string', {
      source: 'uncaught',
      error: 'plain string',
    });
  });

  it('works when no logger or telemetry adapters are provided', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), AppErrorHandler],
    });

    expect(() => TestBed.inject(AppErrorHandler).handleError(new Error('safe'))).not.toThrow();
  });
});
