import { InjectionToken } from '@angular/core';

export interface ErrorReportContext {
  /** Discriminator such as 'app-error' or 'api-error'. */
  kind: string;
  [key: string]: unknown;
}

/**
 * Minimal telemetry contract: report failures (optionally with context) to an
 * external sink. Adapters: Sentry, OpenTelemetry traces, Azure Monitor, etc.
 */
export interface TelemetryPort {
  reportError(error: unknown, context: ErrorReportContext): void;
}

export const TELEMETRY = new InjectionToken<TelemetryPort>('core.TelemetryPort');
