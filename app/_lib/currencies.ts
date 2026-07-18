/** Fixed set of ISO 4217 currencies offered for base/display currency (LDG-01). */
export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SEK', label: 'Swedish Krona' },
  { code: 'NOK', label: 'Norwegian Krone' },
  { code: 'ZAR', label: 'South African Rand' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'MXN', label: 'Mexican Peso' },
] as const;

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_CODES = new Set<string>(CURRENCIES.map((currency) => currency.code));
