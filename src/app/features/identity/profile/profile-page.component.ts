import { Component, inject } from '@angular/core';
import { AuthSessionService } from '../../../core/services/auth-session.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

@Component({
  selector: 'app-profile-page',
  imports: [PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'profile.title' | tr" />

    @if (authSession.user(); as user) {
      <dl class="profile-facts card">
        <div>
          <dt>{{ 'profile.name' | tr }}</dt>
          <dd>{{ user.fullName }}</dd>
        </div>
        <div>
          <dt>{{ 'profile.email' | tr }}</dt>
          <dd>{{ user.email }}</dd>
        </div>
        <div>
          <dt>{{ 'profile.roles' | tr }}</dt>
          <dd>
            <ul class="tag-list">
              @for (role of user.roles; track role) {
                <li>{{ role }}</li>
              }
            </ul>
          </dd>
        </div>
        <div>
          <dt>{{ 'profile.permissions' | tr }}</dt>
          <dd>
            <ul class="tag-list">
              @for (permission of user.permissions; track permission) {
                <li>{{ permission }}</li>
              }
            </ul>
          </dd>
        </div>
      </dl>
    } @else {
      <p class="muted">{{ 'profile.signedOut' | tr }}</p>
    }
  `,
  styles: `
    .profile-facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--space-4);
      margin: 0;

      div {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      dt {
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-muted);
      }

      dd {
        margin: 0;
      }
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        padding: 0 var(--space-2);
        font-size: 0.85rem;
      }
    }
  `
})
export class ProfilePageComponent {
  protected readonly authSession = inject(AuthSessionService);
}
