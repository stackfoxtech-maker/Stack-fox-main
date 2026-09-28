import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Eye, EyeOff } from 'lucide-react';

const LEVELS = [
  { label: 'Too short', bar: 'bg-danger-500' },
  { label: 'Weak', bar: 'bg-danger-500' },
  { label: 'Okay', bar: 'bg-warning-500' },
  { label: 'Good', bar: 'bg-success-500' },
  { label: 'Strong', bar: 'bg-success-500' },
];

// 0 = under the 8-char minimum the API enforces; then +1 per extra signal.
function strength(pw) {
  if (pw.length < 8) return 0;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

/**
 * Auth text field: leading icon that lights up on focus, animated "valid"
 * tick, optional password reveal + strength meter.
 */
export default function AuthField({
  label,
  icon: Icon,
  valid = false,
  helperText,
  password = false,
  showStrength = false,
  value = '',
  ...props
}) {
  const [show, setShow] = useState(false);
  const level = strength(value);
  const id = props.id || `f-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-warm-700">
        {label}
      </label>
      <div className="group relative">
        {Icon && (
          <Icon
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-warm-400 transition-colors duration-200 group-focus-within:text-fox-500"
          />
        )}
        <input
          {...props}
          id={id}
          value={value}
          type={password ? (show ? 'text' : 'password') : props.type}
          className={`input-fx ${Icon ? 'pl-11' : ''} pr-11 hover:border-warm-300`}
        />
        {password ? (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-warm-400 transition hover:text-warm-700"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : (
          valid && (
            <motion.span
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="absolute right-3.5 top-1/2 -mt-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-success-500 text-white"
            >
              <Check size={12} strokeWidth={3} />
            </motion.span>
          )
        )}
      </div>
      {helperText && !(showStrength && value) && (
        <p className="mt-1.5 text-xs text-warm-400">{helperText}</p>
      )}
      {showStrength && value && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= level ? LEVELS[level].bar : 'bg-warm-200'
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-warm-500">
            {LEVELS[level].label}
            {level === 0 && ' — use at least 8 characters'}
          </p>
        </div>
      )}
    </div>
  );
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
