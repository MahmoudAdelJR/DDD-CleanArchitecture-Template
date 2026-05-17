import { Observable } from 'rxjs';

export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Observable<TResponse>;
}

export interface NoInputUseCase<TResponse> {
  execute(): Observable<TResponse>;
}