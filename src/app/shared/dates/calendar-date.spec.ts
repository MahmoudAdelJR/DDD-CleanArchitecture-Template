import { isCalendarDateString, toCalendarDate, toCalendarDateString } from './calendar-date';

describe('calendar-date utilities', () => {
  it('recognizes only valid yyyy-MM-dd calendar strings', () => {
    expect(isCalendarDateString('2024-02-29')).toBeTrue();
    expect(isCalendarDateString('2024-2-29')).toBeFalse();
    expect(isCalendarDateString('2024-02-30')).toBeFalse();
    expect(isCalendarDateString('2024-02-29T00:00:00Z')).toBeFalse();
  });

  it('parses calendar dates as local midnight (no UTC day shift)', () => {
    const date = toCalendarDate('2024-01-01');

    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2024);
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(1);
    expect(date!.getHours()).toBe(0);
  });

  it('round-trips a Date to its local calendar string', () => {
    const lateEvening = new Date(2024, 9, 15, 23, 30);
    expect(toCalendarDateString(lateEvening)).toBe('2024-10-15');

    const reconstructed = toCalendarDate(toCalendarDateString(lateEvening));
    expect(reconstructed!.getDate()).toBe(15);
  });

  it('rejects malformed strings when parsing', () => {
    expect(toCalendarDate('not-a-date')).toBeNull();
  });
});
