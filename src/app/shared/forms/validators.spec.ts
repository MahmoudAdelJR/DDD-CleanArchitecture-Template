import { FormControl, FormGroup } from '@angular/forms';
import { dateRange, matchingFields, trimmedRequired } from './validators';

describe('trimmedRequired', () => {
  const validate = trimmedRequired();

  it('flags missing values as required', () => {
    expect(validate(new FormControl(''))).toEqual({ required: true });
    expect(validate(new FormControl(null))).toEqual({ required: true });
    expect(validate(new FormControl(undefined))).toEqual({ required: true });
  });

  it('flags whitespace-only values as requiredTrimmed', () => {
    expect(validate(new FormControl('   '))).toEqual({ requiredTrimmed: true });
  });

  it('accepts real values', () => {
    expect(validate(new FormControl('a'))).toBeNull();
    expect(validate(new FormControl(0))).toBeNull();
  });
});

describe('matchingFields', () => {
  it('requires the sibling control to have the same value', () => {
    const group = new FormGroup({
      password: new FormControl('secret'),
      confirm: new FormControl('')
    });
    group.controls['confirm'].addValidators(matchingFields('password'));
    group.controls['confirm'].updateValueAndValidity();

    expect(group.controls['confirm'].hasError('mustMatch')).toBeTrue();

    group.controls['confirm'].setValue('secret');
    expect(group.controls['confirm'].hasError('mustMatch')).toBeFalse();
  });
});

describe('dateRange', () => {
  it('fails when the end date precedes the start date', () => {
    const group = new FormGroup(
      {
        start: new FormControl('2024-05-10'),
        end: new FormControl('2024-05-01')
      },
      [dateRange('start', 'end')]
    );

    expect(group.hasError('invalidDateRange')).toBeTrue();

    group.controls['end'].setValue('2024-06-01');
    expect(group.hasError('invalidDateRange')).toBeFalse();
  });
});
