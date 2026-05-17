// core/services/notification.service.ts

import { Injectable } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationMessage {
  type: NotificationType;
  title?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  show(notification: NotificationMessage): void {
    // Connect this later to Angular Material, PrimeNG, NG-Zorro, Toastr, etc.
    console.log(notification);
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