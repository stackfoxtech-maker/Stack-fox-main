import { clsx } from 'clsx';
import DOMPurify from 'dompurify';

/**
 * Merge classnames (clsx wrapper for Tailwind).
 */
export const cn = (...inputs) => clsx(inputs);

/**
 * Sanitize HTML before dangerouslySetInnerHTML. Blog/guide content is stored
 * unsanitized server-side, so this is the only thing standing between a
 * malicious <script>/onerror payload and every visitor's browser.
 */
export const sanitizeHtml = (html) =>
  DOMPurify.sanitize(html ?? '', { USE_PROFILES: { html: true } });

/**
 * Money display.
 *
 * This codebase has two money units and that is not going to change soon, so
 * the formatters say which one they take rather than leaving every call site
 * to remember.
 *
 *   RUPEES  the storefront: shared/stackfox-data.json, the cart, the Builder,
 *           pricing pages. The catalogue file is bundled straight into the
 *           browser, so there is no API boundary that could convert it.
 *           routes/cart.ts states it plainly: `price: number; // rupees`.
 *
 *   PAISE   anything that came from a money column: invoices, payments, rate
 *           cards, change requests, referral commissions.
 *
 * Both render two decimal places. The previous formatter used
 * `maximumFractionDigits: 0`, which silently rounded ₹1,580.85 to ₹1,581 —
 * tolerable on a dashboard headline, wrong on an invoice, where the screen
 * then disagrees with the PDF, the card statement and the GST return. Paise
 * are not rare: 18% GST on ₹999 is exactly ₹179.82.
 */
const inr = (rupees, dp) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(rupees);

const blank = (v) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v));

/** Format an amount already in RUPEES (storefront, cart, Builder). */
export const formatINR = (rupees) => (blank(rupees) ? '—' : inr(Number(rupees), 2));

/** Format an amount in PAISE (anything read from a money column). */
export const formatPaise = (paise) => (blank(paise) ? '—' : inr(Number(paise) / 100, 2));

/**
 * Rounded rupees, no paise — dashboard headlines and chart axes only, where
 * the exact figure is noise. Never an invoice, quote or receipt.
 */
export const formatINRRounded = (rupees) => (blank(rupees) ? '—' : inr(Number(rupees), 0));

/**
 * Short INR format (1.5L, 2.3Cr). Takes RUPEES. Chart axes and compact stats.
 */
export const formatINRShort = (rupees) => {
  const n = Number(rupees ?? 0);
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
};

/**
 * Format a date string or Date object.
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
};

/**
 * Format a date with time.
 */
export const formatDateTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Relative time (e.g., "2 hours ago", "just now").
 */
export const timeAgo = (date) => {
  if (!date) return '';
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

/**
 * Calculate GST (18%) on a subtotal.
 */
export const calcGST = (subtotal, rate = 18) => {
  const gstAmount = Math.round(subtotal * (rate / 100));
  return {
    subtotal,
    rate,
    gstAmount,
    total: subtotal + gstAmount,
  };
};

/**
 * Debounce function.
 */
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Truncate text with ellipsis.
 */
export const truncate = (str, len = 100) => {
  if (!str) return '';
  return str.length > len ? `${str.substring(0, len)}...` : str;
};

/**
 * Capitalize first letter.
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Slugify a string.
 */
export const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Get initials from a name.
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Status badge color mapping.
 */
export const statusColors = {
  // Project statuses
  planning: 'badge-info',
  'in-progress': 'badge-warning',
  'on-hold': 'badge-neutral',
  review: 'badge-fox',
  completed: 'badge-success',
  cancelled: 'badge-danger',

  // Invoice statuses
  draft: 'badge-neutral',
  sent: 'badge-info',
  viewed: 'badge-info',
  paid: 'badge-success',
  'partially-paid': 'badge-warning',
  overdue: 'badge-danger',
  refunded: 'badge-neutral',

  // Quote statuses
  accepted: 'badge-success',
  rejected: 'badge-danger',
  expired: 'badge-neutral',
  converted: 'badge-success',

  // Task statuses
  backlog: 'badge-neutral',
  todo: 'badge-info',
  done: 'badge-success',

  // Ticket statuses
  open: 'badge-warning',
  'waiting-client': 'badge-fox',
  resolved: 'badge-success',
  closed: 'badge-neutral',

  // General
  active: 'badge-success',
  inactive: 'badge-neutral',
  pending: 'badge-warning',
};

/**
 * Get appropriate badge class for a status.
 */
export const getStatusBadge = (status) => statusColors[status] || 'badge-neutral';

/**
 * Priority colors.
 */
export const priorityColors = {
  low: 'text-warm-500',
  medium: 'text-info-500',
  high: 'text-warning-500',
  urgent: 'text-danger-500',
  critical: 'text-danger-700',
};

/**
 * Copy text to clipboard.
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * Generate a random color for avatars.
 */
const avatarColors = [
  'bg-fox-100 text-fox-700',
  'bg-info-50 text-info-700',
  'bg-success-50 text-success-700',
  'bg-warning-50 text-warning-700',
  'bg-danger-50 text-danger-700',
];

export const getAvatarColor = (name) => {
  if (!name) return avatarColors[0];
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};
