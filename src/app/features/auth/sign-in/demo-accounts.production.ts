import type { DemoAccountHint } from './demo-account-hint.model';

/**
 * Production build of the login demo hints. Replaces `demo-accounts.ts` via
 * angular.json `fileReplacements`; the empty list hides the hint block so no
 * demo credentials appear in the UI or the bundle.
 */
export const DEMO_ACCOUNT_HINTS: DemoAccountHint[] = [];
