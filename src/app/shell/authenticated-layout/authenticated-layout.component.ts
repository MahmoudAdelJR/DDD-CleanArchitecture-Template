import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthSessionService } from '../../core/services/auth-session.service';

@Component({
  selector: 'app-authenticated-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './authenticated-layout.component.html',
  styleUrl: './authenticated-layout.component.scss'
})
export class AuthenticatedLayoutComponent {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  protected readonly user = this.authSession.user;

  protected signOut(): void {
    this.authSession.clearSession();
    this.router.navigateByUrl('/login');
  }
}
