import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

export type QueryValue = string | number | boolean | Date | null | undefined;
export type QueryParams = Record<string, QueryValue | ReadonlyArray<QueryValue>>;

export abstract class BaseHttpService {
  protected readonly http = inject(HttpClient);

  protected get<T>(url: string, params?: QueryParams, context?: HttpContext): Observable<T> {
    return this.http.get<T>(url, {
      params: this.toHttpParams(params),
      context,
    });
  }

  protected post<T>(
    url: string,
    body: unknown,
    params?: QueryParams,
    context?: HttpContext,
  ): Observable<T> {
    return this.http.post<T>(url, body, { params: this.toHttpParams(params), context });
  }

  protected put<T>(url: string, body: unknown, context?: HttpContext): Observable<T> {
    return this.http.put<T>(url, body, { context });
  }

  protected patch<T>(url: string, body: unknown, context?: HttpContext): Observable<T> {
    return this.http.patch<T>(url, body, { context });
  }

  protected delete<T>(url: string, params?: QueryParams, context?: HttpContext): Observable<T> {
    return this.http.delete<T>(url, { params: this.toHttpParams(params), context });
  }

  protected toHttpParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (!params) {
      return httpParams;
    }

    for (const [key, value] of Object.entries(params)) {
      const values: readonly QueryValue[] = Array.isArray(value)
        ? (value as readonly QueryValue[])
        : [value as QueryValue];
      for (const item of values) {
        const serialized = serializeValue(item);
        if (serialized !== null) {
          httpParams = httpParams.append(key, serialized);
        }
      }
    }

    return httpParams;
  }
}

function serializeValue(value: QueryValue): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
