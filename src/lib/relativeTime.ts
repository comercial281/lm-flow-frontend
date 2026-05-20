export type FormatRelativeTimeOptions = {
  locale: string;
  justNowLabel: string;
  justNowThresholdSeconds?: number;
};

const DEFAULT_JUST_NOW_SECONDS = 5;

export function formatRelativeTime(
  date: Date,
  now: Date,
  { locale, justNowLabel, justNowThresholdSeconds = DEFAULT_JUST_NOW_SECONDS }: FormatRelativeTimeOptions,
): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.round(Math.abs(diffMs) / 1000);

  if (diffSec < justNowThresholdSeconds) return justNowLabel;

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSec < 60) return rtf.format(-diffSec, 'second');

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, 'minute');

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, 'hour');

  const diffDay = Math.round(diffHr / 24);
  return rtf.format(-diffDay, 'day');
}
