// core/services/loading.service.ts

import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pendingCount = signal(0);

  readonly isLoading = computed(() => this.pendingCount() > 0);

  show(): void {
    this.pendingCount.update((value) => value + 1);
  }

  hide(): void {
    this.pendingCount.update((value) => Math.max(0, value - 1));
  }

  reset(): void {
    this.pendingCount.set(0);
  }
}
