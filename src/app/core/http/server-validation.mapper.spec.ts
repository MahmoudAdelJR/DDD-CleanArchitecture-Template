import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { ApiError } from './api-error';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from './server-validation.mapper';

function apiError(validationErrors: Record<string, string[]>): ApiError {
  const httpError = new HttpErrorResponse({ status: 400 });
  return new ApiError(400, 'validation failed', null, validationErrors, null, httpError);
}

describe('applyServerValidationErrors', () => {
  function form(): FormGroup {
    return new FormGroup({
      email: new FormControl('a@b.c'),
      address: new FormGroup({ city: new FormControl('X') }),
      untouched: new FormControl('keep'),
    });
  }

  it('maps PascalCase and dashed keys onto matching controls', () => {
    const group = form();

    applyServerValidationErrors(
      group,
      apiError({ Email: ['Address is invalid.'], 'address-city': ['Unknown city.'] }),
    );

    expect(group.controls['email'].errors).toEqual({ server: ['Address is invalid.'] });
    expect((group.controls['address'] as FormGroup).controls['city'].errors).toEqual({
      server: ['Unknown city.'],
    });
  });

  it('routes general and unmatched keys to the target control', () => {
    const group = form();

    applyServerValidationErrors(
      group,
      apiError({ general: ['Something is wrong.'], unknown_field: ['Mystery.'] }),
    );

    expect(group.errors).toEqual({ server: ['Something is wrong.', 'Mystery.'] });
  });

  it('preserves local validator errors and clears previous server errors', () => {
    const group = form();
    group.controls['email'].setErrors({ server: ['old'] });
    group.controls['untouched'].setErrors({ required: true });

    applyServerValidationErrors(group, apiError({ untouched: ['taken.'] }));

    expect(group.controls['untouched'].errors).toEqual({ required: true, server: ['taken.'] });
    expect(group.controls['email'].errors).toBeNull();
  });

  it('clearServerValidationErrors strips only server keys', () => {
    const group = form();
    group.controls['email'].setErrors({ server: ['x'], email: true });

    clearServerValidationErrors(group);

    expect(group.controls['email'].errors).toEqual({ email: true });
  });
});
