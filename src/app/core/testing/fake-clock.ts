import type { Clock, TimerHandle } from '../time/clock.port';

/**
 * Deterministic `Clock` for specs. Time only moves when the test calls
 * `advanceBy`, and timers fire in due-time order with their handlers.
 */
export class FakeClock implements Clock {
  private currentTime: number;
  private nextId = 1;
  private readonly timers = new Map<number, { at: number; handler: () => void }>();

  constructor(startTime = 0) {
    this.currentTime = startTime;
  }

  now(): number {
    return this.currentTime;
  }

  setTimer(delayMs: number, handler: () => void): TimerHandle {
    const id = this.nextId++;
    this.timers.set(id, { at: this.currentTime + Math.max(0, delayMs), handler });
    return id;
  }

  clearTimer(handle: TimerHandle): void {
    this.timers.delete(handle as number);
  }

  /** Number of timers still waiting to fire. */
  get pendingTimers(): number {
    return this.timers.size;
  }

  /** Advances the clock and runs every timer that becomes due (once each). */
  advanceBy(ms: number): void {
    this.currentTime += ms;

    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= this.currentTime)
        .sort((a, b) => a[1].at - b[1].at);

      if (due.length === 0) {
        return;
      }

      for (const [id, timer] of due) {
        if (this.timers.delete(id)) {
          timer.handler();
        }
      }
    }
  }
}
