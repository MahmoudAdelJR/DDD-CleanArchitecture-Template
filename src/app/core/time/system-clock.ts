import { Injectable } from '@angular/core';
import type { Clock, TimerHandle } from './clock.port';

/** Production `Clock` backed by `Date.now()` and the global timer functions. */
@Injectable()
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  setTimer(delayMs: number, handler: () => void): TimerHandle {
    return setTimeout(handler, Math.max(0, delayMs));
  }

  clearTimer(handle: TimerHandle): void {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  }
}
