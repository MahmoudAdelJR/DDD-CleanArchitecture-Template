// core/interceptors/error.interceptor.ts

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

// Define the interface matching your .NET Core ProblemDetails structure
interface ProblemDetails {
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: Array<{ code: string; description: string }>;
}

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const notification = inject(NotificationService);

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'Something went wrong. Please try again.';

      // Check if the backend returned a structured JSON error body
      if (error.error && typeof error.error === 'object') {
        const problemDetails = error.error as ProblemDetails;

        if (problemDetails.errors && problemDetails.errors.length > 0) {
          // Combine all validation error descriptions (separated by newlines)
          message = problemDetails.errors.map(err => err.description).join('\n');
        } else if (problemDetails.detail) {
          // Fallback to high-level detail
          message = problemDetails.detail;
        } else if (problemDetails.title) {
          // Fallback to generic title
          message = problemDetails.title;
        }
      } else if (error.message) {
        // Fallback to generic HTTP error message (e.g., network failure)
        message = error.message;
      }

      notification.error(message);

      return throwError(() => error);
    })
  );
};