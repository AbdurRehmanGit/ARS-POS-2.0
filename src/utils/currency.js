// Standardized currency definitions and formatting utilities

export const CURRENCIES = [
  { code: 'PKR', symbol: 'PKR', name: 'Pakistani Rupee', label: 'PKR - Pakistani Rupee (PKR)' },
  { code: 'USD', symbol: '$', name: 'US Dollar', label: 'USD - US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro', label: 'EUR - Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound', label: 'GBP - British Pound (£)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', label: 'AED - UAE Dirham (AED)' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', label: 'SAR - Saudi Riyal (SAR)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', label: 'CAD - Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', label: 'AUD - Australian Dollar (AU$)' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', label: 'INR - Indian Rupee (₹)' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', label: 'KWD - Kuwaiti Dinar (KD)' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', label: 'QAR - Qatari Riyal (QR)' },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', label: 'OMR - Omani Rial (OMR)' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', label: 'TRY - Turkish Lira (₺)' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', label: 'MYR - Malaysian Ringgit (RM)' },
  { code: 'SGD', symbol: 'SG$', name: 'Singapore Dollar', label: 'SGD - Singapore Dollar (SG$)' },
];

export const DEFAULT_CURRENCY = 'PKR';

export function getCurrency(code) {
  const found = CURRENCIES.find((c) => c.code === (code || '').toUpperCase());
  return found || CURRENCIES[0];
}

export function formatPrice(amount, currencyCode = DEFAULT_CURRENCY, decimals = 2) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  const formattedNum = isNaN(num) ? '0.00' : num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${code} ${formattedNum}`;
}
