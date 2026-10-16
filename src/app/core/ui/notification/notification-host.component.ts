import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';
import type { AppNotification } from '../../services/notification.service';

@Component({
  selector: 'app-notification-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="notification-host" aria-live="polite" aria-label="Notifications">
      @for (notification of notifications(); track notification.id) {
        <div
          class="toast"
          [class]="'toast toast--' + notification.type"
          [attr.role]="notification.type === 'error' ? 'alert' : 'status'"
        >
          <div class="toast__body">
            @if (notification.title) {
              <strong class="toast__title">{{ notification.title }}</strong>
            }
            <span class="toast__message">{{ notification.message }}</span>
          </div>
          <button
            type="button"
            class="toast__dismiss"
            aria-label="Dismiss notification"
            (click)="dismiss(notification)"
          >
            &times;
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './notification-host.component.scss',
})
export class NotificationHostComponent {
  private readonly service = inject(NotificationService);
  protected readonly notifications = this.service.notifications;

  protected dismiss(notification: AppNotification): void {
    this.service.dismiss(notification.id);
  }
}
