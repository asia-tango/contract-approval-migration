/** 1234567.8 → «1 234 567,80» (як у легасі); з `fractionDigits = 0` → «1 234 568». */
export function formatMoney(value: number, fractionDigits = 2): string {
  const [int, frac] = value.toFixed(fractionDigits).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+$)/g, ' ');
  return frac ? `${grouped},${frac}` : grouped;
}
