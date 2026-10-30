import { parseApiDate, toApiDate } from './dates';

describe('dates', () => {
  it.each(['2026-10-01', '2026-12-31', '2026-01-01'])('%s → Date → той самий рядок, без зсуву доби', (value) => {
    const date = parseApiDate(value);
    const [year, month, day] = value.split('-').map(Number);
    expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([year, month, day]);
    expect(toApiDate(date)).toBe(value);
  });
});
