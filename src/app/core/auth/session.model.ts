export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  permissions: string[];
  roles: string[];
}

export interface SessionPayload {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  /** Unix epoch (ms) of access-token expiry. `null` means "unknown/no expiry". */
  expiresAt: number | null;
}
