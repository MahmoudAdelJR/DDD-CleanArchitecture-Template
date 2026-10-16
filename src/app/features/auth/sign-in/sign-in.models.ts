import type { SessionPayload } from '../../../core/auth/session.model';

export interface SignInCredentials {
  email: string;
  password: string;
}

export type AuthenticatedSession = SessionPayload;
