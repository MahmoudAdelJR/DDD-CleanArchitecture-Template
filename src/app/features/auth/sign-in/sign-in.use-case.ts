import { inject, Injectable } from '@angular/core';
import { AuthSessionService } from '../../../core/services/auth-session.service';
import { AUTHENTICATION_PORT } from '../data-access/authentication.port';
import type { SignInCredentials } from './sign-in.models';

@Injectable()
export class SignInUseCase {
  private readonly authentication = inject(AUTHENTICATION_PORT);
  private readonly authSession = inject(AuthSessionService);

  async execute(credentials: SignInCredentials): Promise<void> {
    const session = await this.authentication.signIn(credentials);
    this.authSession.setSession(session);
  }
}
