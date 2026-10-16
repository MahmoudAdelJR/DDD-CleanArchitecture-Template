import { Component, inject } from '@angular/core';
import { AuthSessionService } from '../../../core/services/auth-session.service';

@Component({
  selector: 'app-profile-page',
  template: `
    <header class="page-header">
      <h1>Profile</h1>
    </header>

    @if (authSession.user(); as user) {
      <dl class="profile-facts card">
        <div>
          <dt>Name</dt>
          <dd>{{ user.fullName }}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{{ user.email }}</dd>
        </div>
        <div>
          <dt>Roles</dt>
          <dd>
            <ul class="tag-list">
              @for (role of user.roles; track role) {
                <li>{{ role }}</li>
              }
            </ul>
          </dd>
        </div>
        <div>
          <dt>Permissions</dt>
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
      <p class="muted">You are not signed in.</p>
    }
  `,
  styles: `
    .page-header {
      margin-bottom: var(--space-4);
    }

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
