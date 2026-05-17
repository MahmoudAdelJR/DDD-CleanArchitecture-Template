import { HttpInterceptorFn } from '@angular/common/http';

export const languageInterceptor: HttpInterceptorFn = (request, next) => {
  const language = localStorage.getItem('language') ?? 'en';

  return next(
    request.clone({
      setHeaders: {
        'Accept-Language': language
      }
    })
  );
};