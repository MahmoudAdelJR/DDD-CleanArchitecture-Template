import { CATALOGS } from './locale-catalog';

describe('locale catalogs', () => {
  const locales = Object.keys(CATALOGS);

  it('ships at least the default locale', () => {
    expect(locales).toContain('en');
  });

  it('every locale defines exactly the same keys as the default catalog', () => {
    const reference = Object.keys(CATALOGS['en']).sort();

    for (const locale of locales) {
      const keys = Object.keys(CATALOGS[locale]).sort();
      const missing = reference.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !reference.includes(key));

      expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
    }
  });

  it('has no empty translations', () => {
    for (const locale of locales) {
      const empty = Object.entries(CATALOGS[locale])
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect(empty).toEqual([]);
    }
  });
});
