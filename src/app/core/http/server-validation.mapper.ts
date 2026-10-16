import { AbstractControl } from '@angular/forms';
import { ApiError } from './api-error';

const SERVER_ERROR_KEY = 'server';

/**
 * Maps ApiError.validationErrors onto reactive-form controls.
 * Keys are matched case/separator-insensitively ("Email" or "email-address"
 * matches control "email"); the 'general' bucket (and unmatched keys) are
 * attached to the target control itself.
 */
export function applyServerValidationErrors(
  target: AbstractControl,
  apiError: ApiError
): void {
  clearServerValidationErrors(target);

  const general: string[] = [];

  for (const [key, messages] of Object.entries(apiError.validationErrors)) {
    const control = key === 'general' ? null : findControl(target, key);
    if (!control) {
      general.push(...messages);
      continue;
    }

    control.setErrors({
      ...(control.errors ?? {}),
      [SERVER_ERROR_KEY]: messages
    });
  }

  if (general.length > 0) {
    target.setErrors({ ...(target.errors ?? {}), [SERVER_ERROR_KEY]: general });
  }
}

export function clearServerValidationErrors(target: AbstractControl): void {
  stripServer(target);

  const controls = (
    target as unknown as {
      controls?: AbstractControl[] | Record<string, AbstractControl>;
    }
  ).controls;
  if (!controls) {
    return;
  }

  const children = Array.isArray(controls) ? controls : Object.values(controls);
  children.forEach(clearServerValidationErrors);
}

function stripServer(control: AbstractControl): void {
  if (!control.errors) {
    return;
  }

  const { [SERVER_ERROR_KEY]: _removed, ...rest } = control.errors;
  control.setErrors(Object.keys(rest).length > 0 ? rest : null, { emitEvent: false });
}

function findControl(root: AbstractControl, key: string): AbstractControl | null {
  const normalizedKey = normalize(key);
  let found: AbstractControl | null = null;

  const walk = (control: AbstractControl, path: string): void => {
    if (found) {
      return;
    }
    if (path && normalize(path) === normalizedKey) {
      found = control;
      return;
    }

    const children = (
      control as unknown as { controls?: AbstractControl[] | Record<string, AbstractControl> }
    ).controls;
    if (!children) {
      return;
    }

    const entries: [string, AbstractControl][] = Array.isArray(children)
      ? children.map((child, index) => [String(index), child])
      : Object.entries(children);

    for (const [name, child] of entries) {
      walk(child, path ? `${path}-${name}` : name);
    }
  };

  walk(root, '');
  return found;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[-_ ]/g, '');
}
