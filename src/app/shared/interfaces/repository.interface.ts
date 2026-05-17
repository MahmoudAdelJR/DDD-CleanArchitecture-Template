import { Observable } from 'rxjs';

export interface ReadRepository<TEntity, TKey = string> {
  getById(id: TKey): Observable<TEntity>;
  getAll(): Observable<TEntity[]>;
}

export interface CrudRepository<TEntity, TCreate, TUpdate, TKey = string>
  extends ReadRepository<TEntity, TKey> {
  create(command: TCreate): Observable<TEntity>;
  update(id: TKey, command: TUpdate): Observable<TEntity>;
  delete(id: TKey): Observable<void>;
}