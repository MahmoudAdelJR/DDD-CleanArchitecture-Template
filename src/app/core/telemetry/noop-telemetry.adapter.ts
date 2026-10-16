import { Injectable } from '@angular/core';
import { ErrorReportContext, TelemetryPort } from './telemetry.port';

/**
 * Default adapter: does nothing visible. Replace via
 * { provide: TELEMETRY, useClass: <your-adapter> } in app.config.ts.
 */
@Injectable()
export class NoopTelemetryAdapter implements TelemetryPort {
  reportError(_error: unknown, _context: ErrorReportContext): void {
    // Intentionally empty. Telemetry vendors belong at the composition root
    // so features never import them directly.
  }
}
