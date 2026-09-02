import { cn } from '@lib/utils';

/**
 * StackFox mark — the real fox logo, resized + white keyed to transparent and
 * palette-quantised down to ~22 KB (was a 486 KB 1024² JPEG).
 *
 * `withBackground` gives the "app icon" treatment (Navbar, auth pages): the
 * transparent orange fox on a pale fox-tint square with a soft shadow.
 */
export const BrandLogo = ({ size = 24, className, containerClassName, withBackground = false }) => {
  const box = withBackground ? Math.round(size * 1.5) : size;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden',
        withBackground && 'rounded-xl bg-fox-50 shadow-sm shadow-fox-200',
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
