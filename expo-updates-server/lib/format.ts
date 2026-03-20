import { localeDateTag } from './i18n';
import type { Locale } from './i18n';

export function formatDate(
  value: string | null | undefined,
  locale: Locale = 'en',
): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(localeDateTag(locale));
}

export function parseListInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
