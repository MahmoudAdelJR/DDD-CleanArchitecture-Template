import { InjectionToken } from '@angular/core';
import { SystemClock } from './system-clock';

/** Opaque handle returned by `Clock.setTimer`; only meaningful to that clock. */
export type TimerHandle = unknown;

/**
 * Injectable time source. Anything that needs "now" or a timer depends on this
 * instead of calling `Date.now()`/`setTimeout` directly, so specs can control
 * time deterministically (see `FakeClock`) instead of sleeping.
 */
export interface Clock {
  /** Current epoch time in milliseconds. */
  now(): number;
  /** Runs `handler` once after `delayMs` (clamped to `>= 0`). */
  setTimer(delayMs: number, handler: () => void): TimerHandle;
  /** Cancels a pending timer; a no-op for an already-fired handle. */
  clearTimer(handle: TimerHandle): void;
}

export const CLOCK = new InjectionToken<Clock>('core.Clock', {
  providedIn: 'root',
  factory: () => new SystemClock(),
});
