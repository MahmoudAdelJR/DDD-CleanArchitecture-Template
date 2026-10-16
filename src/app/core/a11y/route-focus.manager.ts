import { DestroyRef, inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Moves focus to the main content landmark after each successful navigation,
 * so screen reader and keyboard users land in the new page instead of staying
 * on the previous focus position. Targets #main (set tabindex if missing).
 */
@Injectable({ providedIn: 'root' })
export class RouteFocusManager {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private lastUrl: string | null = null;
  private started = false;

  watch(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const subscription = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter((event) => event.urlAfterRedirects !== this.lastUrl),
      )
      .subscribe((event) => {
        this.lastUrl = event.urlAfterRedirects;
        this.focusMain();
      });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  private focusMain(): void {
    const main = document.getElementById('main');
    if (!main) {
      return;
    }

    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
    }

    main.focus({ preventScroll: false });
  }
}
