export const record = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {};
export const count = (x: unknown, fallback = 0): number => Number.isSafeInteger(x) && (x as number) >= 0 ? x as number : fallback;
export const strings = (x: unknown): string[] => Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];
export const text = (x: unknown, fallback = ''): string => typeof x === 'string' ? x : fallback;
export const date = (x: unknown): string => {
  if (x === '') return '';
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return '';
  const parsed = new Date(x + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === x ? x : '';
};
