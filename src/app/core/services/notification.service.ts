// core/services/notification.service.ts

import { inject, Injectable, signal } from '@angular/core';
import { DestroyRef } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title?: string;
  message: string;
}

const AUTO_DISMISS_MS: Record<NotificationType, number> = {
  info: 6_000,
  success: 6_000,
  warning: 8_000,
  error: 12_000
};

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly destroyRef = inject(DestroyRef);

  private readonly _notifications = signal<readonly AppNotification[]>([]);
  readonly notifications = this._notifications.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    });
  }

  show(notification: Omit<AppNotification, 'id'>): number {
    const id = this.nextId++;
    this._notifications.update(current => [
      ...current.slice(-4),
      { ...notification, id }
    ]);

    const timer = setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS[notification.type]);
    this.timers.set(id, timer);
    return id;
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this._notifications.update(current => current.filter(item => item.id !== id));
  }

  success(message: string, title?: string): void {
    this.show({ type: 'success', message, title });
  }

  error(message: string, title?: string): void {
    this.show({ type: 'error', message, title });
  }

  warning(message: string, title?: string): void {
    this.show({ type: 'warning', message, title });
  }

  info(message: string, title?: string): void {
    this.show({ type: 'info', message, title });
  }
}
