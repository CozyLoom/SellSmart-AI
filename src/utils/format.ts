import type { BusinessCategory, SupportedCurrency } from '../types';

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  'Fashion and clothing',
  'Electronics',
  'Beauty and cosmetics',
  'Food and beverages',
  'Supermarkets and retail',
  'Digital products',
  'Home and furniture',
  'General merchandise',
  'Other',
];

export const CURRENCY_CONFIG: Record<
  SupportedCurrency,
  { symbol: string; name: string; locale: string; decimals: number; country: string; phoneHint: string }
> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US', decimals: 2, country: 'United States', phoneHint: '+1 555 010 2400' },
  UGX: { symbol: 'UGX', name: 'Ugandan Shilling', locale: 'en-UG', decimals: 0, country: 'Uganda', phoneHint: '+256 772 123 456' },
  EUR: { symbol: '€', name: 'Euro', locale: 'en-IE', decimals: 2, country: 'Germany', phoneHint: '+49 30 1234 5678' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB', decimals: 2, country: 'United Kingdom', phoneHint: '+44 20 7946 0921' },
  KES: { symbol: 'KES', name: 'Kenyan Shilling', locale: 'en-KE', decimals: 2, country: 'Kenya', phoneHint: '+254 712 345 678' },
  TZS: { symbol: 'TZS', name: 'Tanzanian Shilling', locale: 'en-TZ', decimals: 0, country: 'Tanzania', phoneHint: '+255 713 123 456' },
  NGN: { symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG', decimals: 2, country: 'Nigeria', phoneHint: '+234 803 123 4567' },
  ZAR: { symbol: 'R', name: 'South African Rand', locale: 'en-ZA', decimals: 2, country: 'South Africa', phoneHint: '+27 82 123 4567' },
};

export const COUNTRIES_LIST = [
  { name: 'United States', currency: 'USD' as SupportedCurrency, timezone: 'America/New_York' },
  { name: 'Uganda', currency: 'UGX' as SupportedCurrency, timezone: 'Africa/Kampala' },
  { name: 'Kenya', currency: 'KES' as SupportedCurrency, timezone: 'Africa/Nairobi' },
  { name: 'Tanzania', currency: 'TZS' as SupportedCurrency, timezone: 'Africa/Dar_es_Salaam' },
  { name: 'Nigeria', currency: 'NGN' as SupportedCurrency, timezone: 'Africa/Lagos' },
  { name: 'South Africa', currency: 'ZAR' as SupportedCurrency, timezone: 'Africa/Johannesburg' },
  { name: 'United Kingdom', currency: 'GBP' as SupportedCurrency, timezone: 'Europe/London' },
  { name: 'Germany', currency: 'EUR' as SupportedCurrency, timezone: 'Europe/Berlin' },
  { name: 'France', currency: 'EUR' as SupportedCurrency, timezone: 'Europe/Paris' },
  { name: 'Canada', currency: 'USD' as SupportedCurrency, timezone: 'America/Toronto' },
  { name: 'United Arab Emirates', currency: 'USD' as SupportedCurrency, timezone: 'Asia/Dubai' },
  { name: 'Other International', currency: 'USD' as SupportedCurrency, timezone: 'UTC' },
];

export const TIMEZONES_LIST = [
  'UTC',
  'Africa/Kampala',
  'Africa/Nairobi',
  'Africa/Dar_es_Salaam',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
];

export function formatCurrency(amount: number, currency: SupportedCurrency = 'USD', localeOverride?: string): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(localeOverride || cfg.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    }).format(safeAmount);
  } catch {
    return `${cfg.symbol} ${safeAmount.toFixed(cfg.decimals)}`;
  }
}

export function formatNumber(value: number, locale = 'en-US'): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale).format(safe);
}

export function formatDate(isoOrDate: string | null | undefined, timezone?: string): string {
  if (!isoOrDate) return '—';
  const parsed = new Date(isoOrDate.length === 10 ? `${isoOrDate}T12:00:00Z` : isoOrDate);
  if (Number.isNaN(parsed.getTime())) return isoOrDate;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: timezone || 'UTC',
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
}
