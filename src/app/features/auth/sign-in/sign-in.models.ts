import type { AuthUser } from '../../../core/services/auth-session.service';

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthenticatedSession {
  user: AuthUser;
  accessToken: string;
}
