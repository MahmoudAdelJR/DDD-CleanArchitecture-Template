export class DateUtil {
  static toIsoDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }
}