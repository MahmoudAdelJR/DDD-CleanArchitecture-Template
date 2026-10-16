import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { TRANSLATION, TranslationPort } from '../i18n/translation.port';
import { FieldErrorComponent } from './field-error.component';

@Component({
  standalone: true,
  imports: [FieldErrorComponent],
  template: `<app-field-error [control]="control" [show]="show" [label]="'Email'" />`,
})
class HostComponent {
  control = new FormControl('', [Validators.required, Validators.email]);
  show = true;
}

describe('FieldErrorComponent', () => {
  function setup(translation?: TranslationPort) {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        ...(translation ? [{ provide: TRANSLATION, useValue: translation }] : []),
      ],
    });
    return TestBed.createComponent(HostComponent);
  }

  it('renders nothing while hidden', () => {
    const fixture = setup();
    fixture.componentInstance.show = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();
  });

  it('renders a localized message when visible and invalid', () => {
    const translation: TranslationPort = {
      locale: () => 'en',
      supportedLocales: () => ['en'],
      translate: (key, params, fallback) =>
        key === 'validation.required' ? `${params?.['label']} is required.` : (fallback ?? key),
      setLocale: () => {},
    };

    const fixture = setup(translation);
    fixture.componentInstance.control.updateValueAndValidity();
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('.field-error');
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('Email is required.');
  });

  it('falls back to the raw message when no translation port is provided', () => {
    const fixture = setup();
    const control = fixture.componentInstance.control;
    control.setErrors({ server: ['Name is taken.'] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.field-error').textContent).toContain(
      'Name is taken.',
    );
  });
});
