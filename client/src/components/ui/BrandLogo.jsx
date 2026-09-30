import { cn } from '@lib/utils';

/**
 * StackFox mark — the real fox logo, resized + white keyed to transparent and
 * palette-quantised down to ~22 KB (was a 486 KB 1024² JPEG).
 *
 * `withBackground` gives the "app icon" treatment (Navbar, auth pages): the
 * transparent orange fox on a pale fox-tint square with a soft shadow.
 */
/** The name, set as StackFox: capital S and F, orange Fox. `dark` is for dark backgrounds. */
export const Wordmark = ({ className, dark = false }) => (
  <span className={cn('font-display font-bold leading-none tracking-[-0.03em]', className)}>
    <span className={dark ? 'text-white' : 'text-warm-900'}>Stack</span>
    <span className="text-fox-500">Fox</span>
  </span>
);

/** "by Artwall Labs": small caps-style line under the wordmark, light and widely spaced. */
export const Tagline = ({ dark = false, className }) => (
  <span
    className={cn(
      'block text-[9px] font-semibold uppercase leading-none tracking-[0.18em]',
      dark ? 'text-warm-300' : 'text-warm-400',
      className,
    )}
  >
    by Artwall Labs
  </span>
);

export const BrandLogo = ({ size = 24, className, containerClassName, withBackground = false }) => {
  const box = withBackground ? Math.round(size * 1.55) : size;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden',
        withBackground &&
          'rounded-[0.8rem] border border-warm-200 bg-white shadow-[0_1px_2px_rgba(26,25,24,0.06),0_4px_10px_-4px_rgba(26,25,24,0.12)]',
        containerClassName,
      )}
      style={{ width: box, height: box }}
    >
      <img
        src="/logo.png"
        alt="StackFox"
        width={size}
        height={size}
        className={cn('object-contain', className)}
        style={{ width: size, height: size }}
      />
    </div>
  );
};
