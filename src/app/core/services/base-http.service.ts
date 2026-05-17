import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

export abstract class BaseHttpService {
  protected readonly http = inject(HttpClient);

  protected get<T>(url: string, params?: Record<string, unknown>): Observable<T> {
    return this.http.get<T>(url, {
      params: this.toHttpParams(params)
    });
  }

  protected post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<T>(url, body);
  }

  protected put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<T>(url, body);
  }

  protected patch<T>(url: string, body: unknown): Observable<T> {
    return this.http.patch<T>(url, body);
  }

  protected delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(url);
  }

  private toHttpParams(params?: Record<string, unknown>): HttpParams {
    let httpParams = new HttpParams();

    if (!params) {
      return httpParams;
    }

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }
}