import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Required + rejects values that are only whitespace. Error keys: required | requiredTrimmed. */
export function trimmedRequired(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') {
      return { required: true };
    }
    if (typeof value === 'string' && value.trim() === '') {
      return { requiredTrimmed: true };
    }
    return null;
  };
}

/** Marks this control invalid when its value differs from another control's value. */
export function matchingFields(otherControlKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherControlKey);
    if (!other || control.value === other.value) {
      return null;
    }
    return { mustMatch: true };
  };
}

/**
 * Group-level validator ensuring one date control is not after another.
 * Attach to the FormGroup. Error surfaces on the group under invalidDateRange.
 */
export function dateRange(startKey: string, endKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey)?.value as string | null | undefined;
    const end = group.get(endKey)?.value as string | null | undefined;
    if (!start || !end || start <= end) {
      return null;
    }
    return { invalidDateRange: { start, end } };
  };
}
