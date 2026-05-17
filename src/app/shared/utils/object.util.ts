export class ObjectUtil {
  static removeEmpty<T extends Record<string, unknown>>(object: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(object).filter(
        ([, value]) => value !== undefined && value !== null && value !== ''
      )
    ) as Partial<T>;
  }
}