import { forwardRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn, getInitials, getAvatarColor } from '@lib/utils';

// ── Button ──────────────────────────────────

export const Button = forwardRef(({
  children, variant = 'primary', size = 'md', isLoading, className, disabled, ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-[transform,background,color] duration-short ease-enter whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fox-500/30 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'btn-fox',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'bg-danger-500 text-white hover:bg-danger-700 rounded-pill min-h-[2.75rem]',
    link: 'text-fox-600 hover:text-fox-700 underline-offset-4 hover:underline p-0',
  };

  const sizes = {
    sm: 'text-sm px-4 py-2 rounded-pill min-h-[2.25rem]',
    md: 'text-[15px] px-5 py-2.5 rounded-pill',
    lg: 'text-base px-7 py-3.5 rounded-pill',
    icon: 'p-3 rounded-md',
  };

  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], variant !== 'link' && sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  );
});
Button.displayName = 'Button';

// ── Input ───────────────────────────────────

export const Input = forwardRef(({ label, error, helperText, className, ...props }, ref) => (
  <div className="w-full">
    {label && (
      <label className="block text-sm font-medium text-warm-700 mb-1.5">{label}</label>
    )}
    <input
      ref={ref}
      className={cn('input-fx', error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20', className)}
      {...props}
    />
    {error ? (
      <p className="text-sm text-danger-500 mt-1">{error}</p>
    ) : helperText ? (
      <p className="text-xs text-warm-400 mt-1">{helperText}</p>
    ) : null}
  </div>
));
Input.displayName = 'Input';

// ── Textarea ────────────────────────────────

export const Textarea = forwardRef(({ label, error, className, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-warm-700 mb-1.5">{label}</label>}
    <textarea
      ref={ref}
      className={cn('input-fx min-h-[100px] resize-y', error && 'border-danger-500', className)}
      {...props}
    />
    {error && <p className="text-sm text-danger-500 mt-1">{error}</p>}
  </div>
));
Textarea.displayName = 'Textarea';

// ── Select ──────────────────────────────────

export const Select = forwardRef(({ label, error, options = [], placeholder, className, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-warm-700 mb-1.5">{label}</label>}
    <select ref={ref} className={cn('input-fx', className)} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <p className="text-sm text-danger-500 mt-1">{error}</p>}
  </div>
));
Select.displayName = 'Select';

// ── Modal ───────────────────────────────────

export const Modal = ({ isOpen, onClose, title, children, size = 'md', className }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-warm-900/40 backdrop-blur-sm" />
      <div
        className={cn(
          'relative w-full bg-white rounded-2xl shadow-modal animate-scale-in overflow-hidden',
          sizes[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-warm-100">
            <h3 className="text-lg font-semibold text-warm-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-warm-100 transition-colors text-warm-500 hover:text-warm-800"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// ── Spinner ─────────────────────────────────

export const Spinner = ({ size = 'md', className }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8', xl: 'w-12 h-12' };
  return (
    <div
      className={cn('animate-spin rounded-full border-2 border-warm-200 border-t-fox-500', sizes[size], className)}
    />
  );
};

// ── Badge ───────────────────────────────────

export const Badge = ({ children, variant = 'neutral', className }) => (
  <span className={cn('badge-fx', `badge-${variant}`, className)}>{children}</span>
);

// ── Avatar ──────────────────────────────────

export const Avatar = ({ name, src, size = 'md', className }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={cn('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium',
        sizes[size],
        getAvatarColor(name),
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
};

// ── Empty state ─────────────────────────────

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {Icon && <Icon size={48} className="text-warm-300 mb-4" strokeWidth={1.5} />}
    <h3 className="text-lg font-medium text-warm-800 mb-1">{title}</h3>
    {description && <p className="text-warm-500 text-sm max-w-md">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

// ── Skeleton loader ─────────────────────────

export const Skeleton = ({ className, ...props }) => (
  <div className={cn('skeleton', className)} {...props} />
);

// ── Page section wrapper ────────────────────

export const Section = ({ children, className, id }) => (
  <section id={id} className={cn('section-padding', className)}>
    <div className="container-fx">{children}</div>
  </section>
);

// ── Section heading ─────────────────────────

export const SectionHeading = ({ label, title, description, center = true }) => (
  <div className={cn('mb-10 md:mb-14', center ? 'text-center flex flex-col items-center' : '')}>
    {label && <span className="eyebrow mb-4">{label}</span>}
    <h2 className="text-3xl md:text-display-lg text-warm-900">{title}</h2>
    {description && (
      <p className={cn('mt-4 text-body-lg text-warm-600', center ? 'max-w-2xl' : 'max-w-xl')}>{description}</p>
    )}
  </div>
);
