/** `yyyy-MM-dd` → локальна дата без зсуву доби (не `new Date('yyyy-MM-dd')`, який рахує за UTC). */
export function parseApiDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Дата з календаря → `yyyy-MM-dd` з локальних року, місяця й дня (не `toISOString()`, який зсуває в UTC). */
export function toApiDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `yyyy-MM-dd` → `дд.мм.рррр`. */
export function formatApiDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

/** «Сьогодні» як `yyyy-MM-dd` за UTC — так рахує сервер. Єдине місце, де рахуємо «сьогодні». */
export function businessToday(): string {
  return new Date().toISOString().slice(0, 10);
}
