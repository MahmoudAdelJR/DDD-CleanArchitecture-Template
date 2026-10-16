import { Injectable, signal } from '@angular/core';
import { SignInFailure } from '../data-access/authentication.port';
import type { SignInCredentials } from './sign-in.models';
import { SignInUseCase } from './sign-in.use-case';

export type SignInStatus = 'idle' | 'submitting' | 'success' | 'failure';

@Injectable()
export class SignInStore {
  readonly status = signal<SignInStatus>('idle');
  readonly errorMessage = signal<string | null>(null);

  constructor(private readonly signInUseCase: SignInUseCase) {}

  async submit(credentials: SignInCredentials): Promise<boolean> {
    this.status.set('submitting');
    this.errorMessage.set(null);

    try {
      await this.signInUseCase.execute(credentials);
      this.status.set('success');
      return true;
    } catch (error) {
      this.status.set('failure');
      this.errorMessage.set(toUserMessage(error));
      return false;
    }
  }

  reset(): void {
    this.status.set('idle');
    this.errorMessage.set(null);
  }
}

function toUserMessage(error: unknown): string {
  if (error instanceof SignInFailure) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}
