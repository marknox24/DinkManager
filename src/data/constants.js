export const MATCH_TYPES = ['Singles', 'Doubles', 'Mixed Doubles', 'Team Event', 'Custom'];

export const MATCH_FORMATS = [
  'Round Robin',
  'Double Round Robin',
  'Single Elimination',
  'Double Elimination',
  'Swiss System',
  'Custom',
];

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'TWD', name: 'Taiwan Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Zloty' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'ILS', name: 'Israeli Shekel' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
];

export const CONTACT_TYPES = ['Phone', 'Email', 'Website'];

export const COURT_TYPES = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'mixed', label: 'Mixed indoor & outdoor' },
];

// Order matters here — it's the display/sort order everywhere sponsors are
// grouped or listed (highest tier first, "regular" last since it carries no
// medal).
export const SPONSOR_TIERS = {
  gold: { label: 'Gold', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 ring-amber-200', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
  silver: { label: 'Silver', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-slate-200', iconBg: 'bg-slate-100', iconText: 'text-slate-500' },
  bronze: { label: 'Bronze', dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 ring-orange-200', iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  regular: { label: 'Regular', dot: 'bg-sky-400', badge: 'bg-sky-50 text-sky-700 ring-sky-200', iconBg: 'bg-sky-50', iconText: 'text-sky-600' },
};

export const EXPENSE_CATEGORIES = [
  'Venue',
  'Equipment',
  'Prizes',
  'Food & Refreshments',
  'Staff & Officials',
  'Marketing',
  'Other',
];

// Quick-add suggestions for a category's qualification checklist — organizers
// can still type any custom label, these just save typing for the common ones.
export const QUALIFICATION_LABEL_PRESETS = [
  'DUPR Requirement',
  'Age Requirement',
  'Gender Requirement',
  'Location / Club Restriction',
  'Previous Podium Restriction',
  'Player Rating Restriction',
  'Partner Requirement',
  'Team / Pair Requirement',
];

export const REGISTRATION_FIELD_TYPES = [
  { value: 'text', label: 'Text box' },
  { value: 'url', label: 'Link / URL' },
  { value: 'file', label: 'File upload' },
];
