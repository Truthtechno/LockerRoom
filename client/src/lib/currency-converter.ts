// Currency conversion rates (approximate, can be updated from API)
// Using approximate mid-market rates as of 2025
const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,      // Base currency
  ZAR: 18.5,     // 1 USD = ~18.5 ZAR
  AED: 3.67,     // 1 USD = ~3.67 AED
  UGX: 3700,     // 1 USD = ~3700 UGX
  EUR: 0.92,     // 1 USD = ~0.92 EUR
  GBP: 0.79,     // 1 USD = ~0.79 GBP
  KES: 128,      // 1 USD = ~128 KES
  NGN: 1600,     // 1 USD = ~1600 NGN
  GHS: 12.5,     // 1 USD = ~12.5 GHS
};

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Convert to USD first (base currency)
  const amountInUSD = amount / (EXCHANGE_RATES[fromCurrency] || 1);
  
  // Convert from USD to target currency
  const amountInTarget = amountInUSD * (EXCHANGE_RATES[toCurrency] || 1);
  
  // Round to 2 decimal places
  return Math.round(amountInTarget * 100) / 100;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get exchange rate between two currencies
 */
export function getExchangeRate(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) {
    return 1;
  }
  
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES[toCurrency] || 1;
  
  return toRate / fromRate;
}

