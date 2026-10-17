import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TRANSLATION } from '../../shared/i18n/translation.port';

/** Components that want to veto an in-app navigation implement this contract. */
export interface PendingChanges {
  hasUnsavedChanges(): boolean;
}

const DEFAULT_PROMPT = 'You have unsaved changes. Leave this page?';

/**
 * Blocks navigation away from a component with unsaved changes until the user
 * confirms. UX-only: it cannot intercept a browser tab close or hard reload —
 * pair it with a host `beforeunload` listener for that case.
 */
export const unsavedChangesGuard: CanDeactivateFn<PendingChanges> = (component) => {
  if (!component || typeof component.hasUnsavedChanges !== 'function') {
    return true;
  }
  if (!component.hasUnsavedChanges()) {
    return true;
  }

  const translation = inject(TRANSLATION, { optional: true });
  const prompt =
    translation?.translate('common.unsavedChangesConfirm', undefined, DEFAULT_PROMPT) ??
    DEFAULT_PROMPT;
  return window.confirm(prompt);
};
