import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RouteFocusManager } from '../../core/a11y/route-focus.manager';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';
import { LocaleSwitcherComponent } from '../locale-switcher/locale-switcher.component';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LocaleSwitcherComponent, TranslatePipe],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.scss',
})
export class AuthenticatedLayoutComponent {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  protected readonly user = this.authSession.user;

  constructor() {
    inject(RouteFocusManager).watch();
  }

  protected signOut(): void {
    this.authSession.clearSession();
    void this.router.navigateByUrl('/login');
  }
}
