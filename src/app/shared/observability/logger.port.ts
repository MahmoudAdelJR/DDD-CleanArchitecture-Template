import { InjectionToken } from '@angular/core';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Business-agnostic logging contract. Implementations must redact sensitive
 * keys before anything reaches an external transport.
 */
export interface LoggerPort {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export const LOGGER = new InjectionToken<LoggerPort>('shared.LoggerPort');
