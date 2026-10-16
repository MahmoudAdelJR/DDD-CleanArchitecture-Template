import { HttpErrorResponse } from '@angular/common/http';

export type MessageResolver = (
  key: string,
  params: Record<string, string | number> | undefined,
  fallback: string
) => string;

/** RFC 7807 / ASP.NET ProblemDetails envelope (all fields optional by spec). */
export interface ProblemDetailsBody {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  traceId?: string;
  errors?: Record<string, string[] | string> | Array<{ code?: string; description?: string }>;
}

export class ApiError {
  constructor(
    readonly status: number,
    readonly message: string,
    readonly code: string | null,
    readonly validationErrors: Record<string, string[]>,
    readonly correlationId: string | null,
    readonly httpError: HttpErrorResponse
  ) {}
}

const DEFAULT_MESSAGES: Record<number | string, string> = {
  0: 'The service is unreachable. Check your connection and try again.',
  400: 'The request was rejected. Please review your input.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource was not found.',
  409: 'This record was changed by someone else. Please reload and try again.',
  422: 'The submitted data failed validation. Please review the form.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server encountered an unexpected error.',
  generic: 'The request failed.'
};

export function normalizeApiError(
  response: HttpErrorResponse,
  resolveMessage?: MessageResolver
): ApiError {
  const t: MessageResolver = resolveMessage
    ? resolveMessage
    : (_key, _params, fallback) => fallback;

  const body = parseProblemDetails(response.error);
  const validationErrors = extractValidationErrors(body);
  const correlationId =
    body?.traceId ?? response.headers.get('x-correlation-id') ?? response.headers.get('traceparent');
  const code = body?.code ?? (body?.type ? lastUrlSegment(body.type) : null);

  const statusFallback =
    response.status === 0
      ? DEFAULT_MESSAGES[0]
      : DEFAULT_MESSAGES[response.status] ??
        (response.status >= 500 ? DEFAULT_MESSAGES[500] : DEFAULT_MESSAGES['generic']);

  const message =
    flattenValidationMessages(validationErrors) ??
    (response.status === 0 ? t('http.0', undefined, DEFAULT_MESSAGES[0]) : null) ??
    body?.detail ??
    body?.title ??
    t(`http.${response.status}`, undefined, statusFallback);

  return new ApiError(response.status, message, code ?? null, validationErrors, correlationId, response);
}

function parseProblemDetails(error: unknown): ProblemDetailsBody | null {
  if (error && typeof error === 'object' && !Array.isArray(error)) {
    return error as ProblemDetailsBody;
  }
  return null;
}

function extractValidationErrors(
  body: ProblemDetailsBody | null
): Record<string, string[]> {
  if (!body?.errors) {
    return {};
  }

  const result: Record<string, string[]> = {};

  if (Array.isArray(body.errors)) {
    // Legacy shape: [{ code, description }]
    for (const entry of body.errors) {
      if (entry?.description) {
        const key = entry.code ?? 'general';
        result[key] = [...(result[key] ?? []), entry.description];
      }
    }
    return result;
  }

  // ASP.NET Identity shape: { Field: ["msg", ...], general: "msg" }
  for (const [key, value] of Object.entries(body.errors)) {
    const messages = Array.isArray(value) ? value : [value];
    result[key] = messages.filter(message => typeof message === 'string' && message.length > 0);
  }
  return result;
}

function flattenValidationMessages(validationErrors: Record<string, string[]>): string | null {
  const all = Object.values(validationErrors).flat();
  return all.length > 0 ? all.join(' ') : null;
}

function lastUrlSegment(value: string): string | null {
  const withoutFragment = value.split(/[#?]/)[0] ?? value;
  const trimmed = withoutFragment.replace(/\/+$/, '');
  const index = trimmed.lastIndexOf('/');
  const segment = index === -1 ? trimmed : trimmed.slice(index + 1);
  return segment ? segment : null;
}
