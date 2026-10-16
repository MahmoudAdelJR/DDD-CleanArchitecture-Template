import { Injectable } from '@angular/core';
import { LoggerPort, LogLevel } from '../../shared/observability/logger.port';

const SECRET_KEY_PATTERN = /(token|password|secret|authorization|cookie|credential|session)/i;
const MAX_CONTEXT_DEPTH = 4;

/**
 * Structured JSON-line console logger with secret redaction and bounded
 * recursion. Swap for a telemetry/OTLP-backed implementation by providing a
 * different LOGGER adapter; consumers never change.
 */
@Injectable()
export class StructuredConsoleLogger implements LoggerPort {
  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const record: Record<string, unknown> = {
      level,
      ts: new Date().toISOString(),
      msg: message,
    };

    const sanitizedContext = context ? this.sanitizeObject(context, 0) : {};
    if (Object.keys(sanitizedContext).length > 0) {
      record['ctx'] = sanitizedContext;
    }

    const line = JSON.stringify(record);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.info(line);
    }
  }

  private sanitizeObject(value: Record<string, unknown>, depth: number): Record<string, unknown> {
    if (depth >= MAX_CONTEXT_DEPTH) {
      return { '[max-depth]': true };
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : this.sanitize(entry, depth + 1);
    }
    return result;
  }

  private sanitize(value: unknown, depth: number): unknown {
    if (value === null || value === undefined) {
      return value ?? null;
    }

    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value !== 'object') {
      return `[unserializable:${typeof value}]`;
    }

    if (depth >= MAX_CONTEXT_DEPTH) {
      return '[max-depth]';
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, depth + 1));
    }

    return this.sanitizeObject(value as Record<string, unknown>, depth);
  }
}
