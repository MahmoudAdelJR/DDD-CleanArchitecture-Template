import { Injectable, inject, signal } from '@angular/core';
import { TRANSLATION } from '../../../shared/i18n/translation.port';
import { SignInFailure } from '../data-access/authentication.port';
import type { SignInCredentials } from './sign-in.models';
import { SignInUseCase } from './sign-in.use-case';

export type SignInStatus = 'idle' | 'submitting' | 'success' | 'failure';

const GENERIC_FAILURE = 'Something went wrong. Please try again.';

@Injectable()
export class SignInStore {
  private readonly signInUseCase = inject(SignInUseCase);
  private readonly translation = inject(TRANSLATION, { optional: true });

  readonly status = signal<SignInStatus>('idle');
  readonly errorMessage = signal<string | null>(null);

  async submit(credentials: SignInCredentials): Promise<boolean> {
    this.status.set('submitting');
    this.errorMessage.set(null);

    try {
      await this.signInUseCase.execute(credentials);
      this.status.set('success');
      return true;
    } catch (error) {
      this.status.set('failure');
      this.errorMessage.set(this.toUserMessage(error));
      return false;
    }
  }

  reset(): void {
    this.status.set('idle');
    this.errorMessage.set(null);
  }

  private toUserMessage(error: unknown): string {
    const fallback = error instanceof SignInFailure ? error.message : GENERIC_FAILURE;

    if (!this.translation) {
      return fallback;
    }

    const code = error instanceof SignInFailure ? error.code : 'unexpected';
    return this.translation.translate(`auth.errors.${code}`, undefined, fallback);
  }
}
