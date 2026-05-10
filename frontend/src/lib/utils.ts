import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return '#8F98AC'
  if (score >= 3.5) return '#039855'
  if (score >= 2.5) return '#2251FF'
  if (score >= 1.5) return '#DC6803'
  return '#D92D20'
}

export function scoreBg(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-neutral-100 text-neutral-500'
  if (score >= 3.5) return 'bg-success-soft text-success-fg'
  if (score >= 2.5) return 'bg-accent-50 text-accent-700'
  if (score >= 1.5) return 'bg-warning-soft text-warning-fg'
  return 'bg-danger-soft text-danger-fg'
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return 'Insufficient Data'
  if (score >= 3.5)  return 'Leading'
  if (score >= 2.5)  return 'Advanced'
  if (score >= 1.5)  return 'Intermediate'
  return 'Foundation'
}

export function formatScore(score: number | null): string {
  return score !== null && !Number.isNaN(score) ? String(Math.round(score)) : '—'
}

const _INR_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Format an integer with Indian commas. */
export function formatIndianInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return _INR_FMT.format(Math.round(value))
}

/** Round any numeric value to a whole number string. Returns '—' for null/NaN. */
export function roundN(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return String(Math.round(value))
}

/** Format a percentage as a whole number with the % sign. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${Math.round(value)}%`
}

/** Format ₹ values. Indian convention: Cr (crore = 10M) is the default; below 1 Cr uses L. */
export function formatCr(valueCr: number | null | undefined): string {
  if (valueCr === null || valueCr === undefined || Number.isNaN(valueCr)) return '—'
  const v = Number(valueCr)
  if (v >= 1) return `₹${formatIndianInt(v)} Cr`
  const lakhs = v * 100
  if (lakhs >= 1) return `₹${formatIndianInt(lakhs)} L`
  return '< ₹1 L'
}

/** Format a numeric range "X–Y" with the given formatter. */
export function formatRange(
  low: number | null | undefined,
  high: number | null | undefined,
  formatter: (v: number) => string,
): string {
  if (low == null || high == null) return '—'
  const a = formatter(low)
  const b = formatter(high)
  return a === b ? a : `${a}–${b}`
}

export function severityColor(severity: string): string {
  if (severity === 'high') return 'text-red-600'
  if (severity === 'medium') return 'text-orange-500'
  return 'text-blue-600'
}
