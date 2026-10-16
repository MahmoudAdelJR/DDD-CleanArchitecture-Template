import { ErrorHandler, inject, Injectable } from '@angular/core';
import { LOGGER } from '../../shared/observability/logger.port';
import { TELEMETRY } from '../telemetry/telemetry.port';

/**
 * Single funnel for uncaught errors: structured, redacted logging plus a
 * telemetry report. Never renders raw errors to users; notifications handle
 * user-facing messaging via the error interceptor.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly logger = inject(LOGGER, { optional: true });
  private readonly telemetry = inject(TELEMETRY, { optional: true });

  handleError(error: unknown): void {
    const { message, cause } = this.describe(error);

    this.logger?.error(message, {
      source: 'uncaught',
      error: cause ?? message,
    });

    this.telemetry?.reportError(error, { kind: 'app-error' });
  }

  private describe(error: unknown): { message: string; cause?: string } {
    if (error instanceof Error) {
      return { message: error.message, cause: `${error.name}: ${error.message}` };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    return { message: 'An unexpected application error occurred.' };
  }
}
