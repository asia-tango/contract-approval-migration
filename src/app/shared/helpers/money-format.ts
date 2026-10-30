/** 1234567.8 → «1 234 567,80» (як у легасі). */
export function formatMoney(value: number): string {
  const [int, frac] = value.toFixed(2).split('.');
  return `${int.replace(/\B(?=(\d{3})+$)/g, ' ')},${frac}`;
}
