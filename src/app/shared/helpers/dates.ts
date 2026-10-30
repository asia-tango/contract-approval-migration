/** `yyyy-MM-dd` → локальна дата без зсуву доби (не `new Date('yyyy-MM-dd')`, який рахує за UTC). */
export function parseApiDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
