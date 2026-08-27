import { cn } from '@lib/utils';

/**
 * Reusable Brand Logo component for consistent branding across the platform.
 * Can be used as a primary logo or as an icon/avatar for AI features (FoxBot).
 */
export const BrandLogo = ({ 
  size = 24, 
  className, 
  containerClassName,
  withBackground = false,
  variant = 'primary'
}) => {
  const isPrimary = variant === 'primary';
  
  return (
    <div className={cn(
      "flex items-center justify-center overflow-hidden shrink-0",
      withBackground && "bg-fox-500 rounded-xl shadow-sm shadow-fox-200",
      containerClassName
    )}
    style={withBackground ? { width: size * 1.5, height: size * 1.5 } : { width: size, height: size }}
    >
      <img 
        src="/logo.png" 
        alt="StackFox Brand" 
        className={cn("object-contain", className)}
        style={{ width: size, height: size }}
      />
    </div>
  );
};
