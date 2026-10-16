import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouteFocusManager } from './route-focus.manager';

@Component({ standalone: true, template: 'a' })
class PageAComponent {}

@Component({ standalone: true, template: 'b' })
class PageBComponent {}

describe('RouteFocusManager', () => {
  let manager: RouteFocusManager;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'a', component: PageAComponent },
          { path: 'b', component: PageBComponent }
        ])
      ]
    });

    document.body.insertAdjacentHTML('afterbegin', '<main id="main"></main>');
    manager = TestBed.inject(RouteFocusManager);
  });

  afterEach(() => {
    document.getElementById('main')?.remove();
  });

  it('moves focus to the main landmark after navigation', async () => {
    manager.watch();

    await TestBed.inject(Router).navigateByUrl('/a');

    expect(document.activeElement?.id).toBe('main');
    expect(document.getElementById('main')?.getAttribute('tabindex')).toBe('-1');
  });

  it('re-focuses on subsequent navigations and ignores duplicate URLs', async () => {
    manager.watch();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/a');
    const main = document.getElementById('main')!;
    main.blur();

    await router.navigateByUrl('/b');
    expect(document.activeElement?.id).toBe('main');

    main.blur();
    await router.navigateByUrl('/b');
    expect(document.activeElement?.id).not.toBe('main');
  });
});
