import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LoadingService } from '../../services/loading.service';

/**
 * Thin indeterminate progress bar shown while HTTP requests are pending.
 * A short display delay avoids flicker on fast requests.
 */
@Component({
  selector: 'app-loading-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="loading-bar" role="progressbar" aria-label="Loading">
        <div class="loading-bar__track"></div>
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1100;
      pointer-events: none;
    }

    .loading-bar__track {
      height: 3px;
      background: linear-gradient(
        90deg,
        var(--color-primary) 0%,
        var(--color-primary) 40%,
        transparent 40%
      );
      background-size: 250% 100%;
      animation: loading-slide 1.1s linear infinite;
    }

    @keyframes loading-slide {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -150% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .loading-bar__track {
        animation: none;
        background: var(--color-primary);
      }
    }
  `,
})
export class LoadingBarComponent {
  private readonly loading = inject(LoadingService);
  private readonly SHOW_DELAY_MS = 200;

  protected readonly visible = signal(false);

  constructor() {
    const shouldBeActive = computed(() => this.loading.isLoading());
    let timer: ReturnType<typeof setTimeout> | null = null;

    effect(() => {
      if (shouldBeActive()) {
        timer ??= setTimeout(() => this.visible.set(true), this.SHOW_DELAY_MS);
      } else {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        this.visible.set(false);
      }
    });
  }
}
