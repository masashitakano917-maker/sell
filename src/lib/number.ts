export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[円,約\s]/g, '').replace(/[〜~].*$/, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

export function yen(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${Math.round(value).toLocaleString('ja-JP')}円`;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
