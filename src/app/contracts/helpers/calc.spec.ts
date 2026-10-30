import { COMMITTEE_LIMIT_UAH } from '../committee-config';
import { calculate, routeFor, vatFor } from './calc';

describe('calc', () => {
  it('routeFor: рівно ліміт — STANDARD, на копійку більше — COMMITTEE', () => {
    expect(routeFor(1_000_000, COMMITTEE_LIMIT_UAH)).toBe('STANDARD');
    expect(routeFor(1_000_000.01, COMMITTEE_LIMIT_UAH)).toBe('COMMITTEE');
  });

  it('calculate: #7 — 23 000 EUR × 44,90 = 1 032 700 грн → COMMITTEE', () => {
    const result = calculate(
      { amount: '23000', currency: 'EUR', vatPayer: true },
      { UAH: 1, USD: 41.2, EUR: 44.9 },
      COMMITTEE_LIMIT_UAH,
    );
    expect(result.amountUah).toBe(1_032_700);
    expect(result.route).toBe('COMMITTEE');
  });

  it('vatFor: сума / 6 з округленням до копійок', () => {
    expect(vatFor(1000)).toBe(166.67);
    expect(vatFor(23_000)).toBe(3833.33);
  });
});
