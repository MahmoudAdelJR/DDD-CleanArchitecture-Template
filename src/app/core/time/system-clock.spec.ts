import { SystemClock } from './system-clock';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('SystemClock', () => {
  it('reports the current epoch time in milliseconds', () => {
    const clock = new SystemClock();

    expect(Math.abs(clock.now() - Date.now())).toBeLessThan(1_000);
  });

  it('runs a scheduled timer', async () => {
    const clock = new SystemClock();
    let fired = false;

    clock.setTimer(0, () => (fired = true));
    await wait(5);

    expect(fired).toBeTrue();
  });

  it('does not run a cleared timer', async () => {
    const clock = new SystemClock();
    let fired = false;

    const handle = clock.setTimer(0, () => (fired = true));
    clock.clearTimer(handle);
    await wait(5);

    expect(fired).toBeFalse();
  });
});
