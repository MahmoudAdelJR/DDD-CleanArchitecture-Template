// core/services/loading.service.ts

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly counter = signal(0);

  readonly isLoading = signal(false);

  show(): void {
    this.counter.update(value => value + 1);
    this.isLoading.set(true);
  }

  hide(): void {
    this.counter.update(value => Math.max(0, value - 1));
    this.isLoading.set(this.counter() > 0);
  }

  reset(): void {
    this.counter.set(0);
    this.isLoading.set(false);
  }
}