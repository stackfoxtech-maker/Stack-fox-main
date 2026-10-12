/**
 * Local responsive photo from public/images. Files are `<base>-<width>.webp`
 * (see CREDITS.md for sources). Always pass the intrinsic width/height so the
 * browser reserves space and nothing shifts while it loads.
 *
 *   <Photo base="/images/about/team-task-board" widths={[800, 1400]}
 *          width={1400} height={875} sizes="(min-width:1024px) 58vw, 100vw"
 *          alt="…" className="h-full w-full object-cover" />
 */
export default function Photo({ base, widths, sizes = '100vw', eager = false, alt, ...rest }) {
  const sorted = [...widths].sort((a, b) => a - b);
  return (
    <img
      src={`${base}-${sorted.at(-1)}.webp`}
      srcSet={sorted.map((w) => `${base}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={eager ? 'high' : undefined}
      {...rest}
    />
  );
}
