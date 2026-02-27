import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'

export function formatRelativeDate(date: string | Date): string {
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'hh:mm a')
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Food & Drinks', icon: 'utensils-crossed' },
  { id: 'groceries', label: 'Groceries', icon: 'shopping-cart' },
  { id: 'transport', label: 'Transport', icon: 'car' },
  { id: 'rent', label: 'Rent', icon: 'home' },
  { id: 'utilities', label: 'Utilities', icon: 'lightbulb' },
  { id: 'entertainment', label: 'Entertainment', icon: 'clapperboard' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-bag' },
  { id: 'medical', label: 'Medical', icon: 'pill' },
  { id: 'travel', label: 'Travel', icon: 'plane' },
  { id: 'other', label: 'Other', icon: 'package' },
] as const

export const TRIP_CATEGORIES = [
  { id: 'food', label: 'Food & Drinks', icon: 'utensils-crossed' },
  { id: 'stay', label: 'Stay / Hotel', icon: 'bed-double' },
  { id: 'transport', label: 'Cabs & Travel', icon: 'car' },
  { id: 'activities', label: 'Activities', icon: 'ferris-wheel' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping-bag' },
  { id: 'tickets', label: 'Tickets & Entry', icon: 'ticket' },
  { id: 'fuel', label: 'Fuel', icon: 'fuel' },
  { id: 'snacks', label: 'Snacks & Chai', icon: 'coffee' },
  { id: 'tips', label: 'Tips', icon: 'banknote' },
  { id: 'other', label: 'Other', icon: 'package' },
] as const

export const QUICK_PRESETS = [
  { label: 'Swiggy Order', category: 'food', icon: 'utensils-crossed' },
  { label: 'Uber Cab', category: 'transport', icon: 'car' },
  { label: 'Rent', category: 'rent', icon: 'home' },
  { label: 'Electricity Bill', category: 'utilities', icon: 'zap' },
  { label: 'Groceries', category: 'groceries', icon: 'shopping-cart' },
  { label: 'Movie Tickets', category: 'entertainment', icon: 'clapperboard' },
] as const

export const TRIP_QUICK_PRESETS = [
  { label: 'Uber / Ola', category: 'transport', icon: 'car' },
  { label: 'Hotel Room', category: 'stay', icon: 'bed-double' },
  { label: 'Restaurant', category: 'food', icon: 'utensils-crossed' },
  { label: 'Petrol / Diesel', category: 'fuel', icon: 'fuel' },
  { label: 'Entry Tickets', category: 'tickets', icon: 'ticket' },
  { label: 'Chai / Snacks', category: 'snacks', icon: 'coffee' },
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['id']

// ── Currency Support for Trip Mode ──────────────────

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED' | 'THB' | 'MYR' | 'JPY' | 'KRW' | 'CHF' | 'NZD' | 'LKR' | 'NPR' | 'BDT' | 'IDR' | 'VND' | 'PHP'

export const CURRENCIES: { code: CurrencyCode; label: string; symbol: string; flag: string }[] = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'USD', label: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', label: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'THB', label: 'Thai Baht', symbol: '฿', flag: '🇹🇭' },
  { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩', flag: '🇰🇷' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$', flag: '🇳🇿' },
  { code: 'LKR', label: 'Sri Lankan Rupee', symbol: 'Rs', flag: '🇱🇰' },
  { code: 'NPR', label: 'Nepalese Rupee', symbol: 'Rs', flag: '🇳🇵' },
  { code: 'BDT', label: 'Bangladeshi Taka', symbol: '৳', flag: '🇧🇩' },
  { code: 'IDR', label: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩' },
  { code: 'VND', label: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳' },
  { code: 'PHP', label: 'Philippine Peso', symbol: '₱', flag: '🇵🇭' },
]

// Approximate exchange rates to INR (updated periodically)
// These are rough rates for offline/instant conversion
export const EXCHANGE_RATES_TO_INR: Record<CurrencyCode, number> = {
  INR: 1,
  USD: 85.5,
  EUR: 92.0,
  GBP: 108.0,
  AUD: 55.0,
  CAD: 61.0,
  SGD: 64.0,
  AED: 23.3,
  THB: 2.45,
  MYR: 19.5,
  JPY: 0.57,
  KRW: 0.062,
  CHF: 97.0,
  NZD: 50.0,
  LKR: 0.28,
  NPR: 0.64,
  BDT: 0.71,
  IDR: 0.0053,
  VND: 0.0034,
  PHP: 1.50,
}

/**
 * Convert an amount from a foreign currency to INR
 */
export function convertToINR(amount: number, currency: CurrencyCode): number {
  const rate = EXCHANGE_RATES_TO_INR[currency] || 1
  return Math.round(amount * rate * 100) / 100
}

/**
 * Format an amount with its currency symbol
 */
export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const cur = CURRENCIES.find(c => c.code === currency)
  const symbol = cur?.symbol || currency
  const formatted = amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${symbol}${formatted}`
}

