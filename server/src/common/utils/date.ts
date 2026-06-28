export function toDateOrNull(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function startOfYear(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

export function startOfNextYear(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1));
}
