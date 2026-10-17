import type { DemoAccountHint } from './demo-account-hint.model';

/**
 * Demo sign-in hints shown on the login screen (development/demo default).
 *
 * Production builds replace this file with `demo-accounts.production.ts`,
 * which exports an empty list, so the credentials below never reach a release
 * bundle. Verified by `npm run check:prod-bundle`.
 */
export const DEMO_ACCOUNT_HINTS: DemoAccountHint[] = [
  { email: 'admin@demo.local', password: 'Admin123!', labelKey: 'auth.demoFullAccess' },
  { email: 'reader@demo.local', password: 'Reader123!', labelKey: 'auth.demoReadOnly' },
];
