export interface Entity<TKey = string> {
  id: TKey;
}

export interface AuditableEntity<TKey = string> extends Entity<TKey> {
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}