import { Pipe, PipeTransform } from '@angular/core';

const compactUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const fullUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** 128400 → "$128.4K" (or "$128,400" with `'full'`). */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: number | null | undefined, mode: 'compact' | 'full' = 'full'): string {
    if (value == null) return '—';
    return mode === 'compact' ? compactUsd.format(value) : fullUsd.format(value);
  }
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['week', 604_800_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** ISO date → "3 hours ago" / "in 12 days". */
@Pipe({ name: 'relative' })
export class RelativeTimePipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '';
    const diff = Date.parse(iso) - Date.now();
    for (const [unit, ms] of UNITS) {
      if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
    }
    return 'just now';
  }
}
