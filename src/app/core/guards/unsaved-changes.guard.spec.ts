import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TRANSLATION, TranslationPort } from '../../shared/i18n/translation.port';
import { PendingChanges, unsavedChangesGuard } from './unsaved-changes.guard';

function run(component: PendingChanges | Record<string, never>): boolean {
  return TestBed.runInInjectionContext(() =>
    unsavedChangesGuard(
      component as PendingChanges,
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
      {} as RouterStateSnapshot,
    ),
  ) as boolean;
}

function componentWith(dirty: boolean): PendingChanges {
  return { hasUnsavedChanges: () => dirty };
}

describe('unsavedChangesGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows navigation for components without a change contract', () => {
    expect(run({})).toBeTrue();
  });

  it('allows navigation when there are no unsaved changes', () => {
    expect(run(componentWith(false))).toBeTrue();
  });

  it('prompts when there are unsaved changes and returns the user choice', () => {
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    expect(run(componentWith(true))).toBeFalse();
    expect(confirm).toHaveBeenCalled();
  });

  it('uses the localized prompt when a translation port is available', () => {
    const translation: TranslationPort = {
      locale: () => 'fr',
      supportedLocales: () => ['fr'],
      translate: (key, _params, fallback) =>
        key === 'common.unsavedChangesConfirm' ? 'Quitter ?' : (fallback ?? key),
      setLocale: () => {},
    };
    TestBed.overrideProvider(TRANSLATION, { useValue: translation });

    const confirm = spyOn(window, 'confirm').and.returnValue(true);
    expect(run(componentWith(true))).toBeTrue();
    expect(confirm).toHaveBeenCalledWith('Quitter ?');
  });
});
