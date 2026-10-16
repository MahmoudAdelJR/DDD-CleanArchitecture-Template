import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TRANSLATION, TranslationPort } from './translation.port';
import { TranslatePipe } from './translate.pipe';

@Component({
  standalone: true,
  imports: [TranslatePipe],
  template: `<span id="out">{{ 'test.greeting' | tr: { name: 'Ada' } }}</span>`
})
class HostComponent {}

function fakeTranslation(initial = 'en'): TranslationPort {
  const dictionaries: Record<string, Record<string, string>> = {
    en: { 'test.greeting': 'Hello, {name}!' },
    fr: { 'test.greeting': 'Bonjour, {name} !' }
  };
  let locale = initial;

  return {
    locale: () => locale,
    supportedLocales: () => ['en', 'fr'],
    translate: (key, params, fallback) => {
      const template = dictionaries[locale]?.[key] ?? dictionaries['en']?.[key] ?? fallback ?? key;
      return params
        ? template.replace(/\{(\w+)\}/g, (_m, n: string) => String(params[n] ?? _m))
        : template;
    },
    setLocale: (l: string) => {
      locale = l;
    }
  };
}

describe('TranslatePipe', () => {
  function createPipe(translation: TranslationPort): TranslatePipe {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TRANSLATION, useValue: translation }
      ]
    });

    return TestBed.runInInjectionContext(() => new TranslatePipe());
  }

  it('interpolates parameters in the active locale', () => {
    const translation = fakeTranslation('en');
    const pipe = createPipe(translation);

    expect(pipe.transform('test.greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('re-evaluates against the live locale (pure: false pipe contract)', () => {
    const translation = fakeTranslation('en');
    const pipe = createPipe(translation);

    translation.setLocale('fr');
    expect(pipe.transform('test.greeting', { name: 'Ada' })).toBe('Bonjour, Ada !');
  });

  it('renders in templates', () => {
    const translation = fakeTranslation('en');

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: TRANSLATION, useValue: translation }
      ]
    });

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#out').textContent.trim()).toBe('Hello, Ada!');
  });
});
