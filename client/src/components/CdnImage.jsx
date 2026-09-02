import { useState } from 'react';
import { cdnImg, cdnSrcSet } from '@lib/img';

/**
 * Marketing image. Serves from Cloudinary (format negotiation + responsive
 * resizing); if that ever fails, falls back to the bundled copy in
 * client/public/img/<name>.webp so a page never renders a broken image.
 *
 *   <CdnImage name="founder-desk" w={900} widths={[480,720,900,1200]}
 *             sizes="(min-width:1024px) 40vw, 100vw"
 *             width={1200} height={900} alt="…" className="…" />
 *
 * `w` sizes the default Cloudinary render; `width`/`height` are the intrinsic
 * ratio hint passed through to the <img> for layout stability.
 */
export default function CdnImage({ name, w = 1200, widths, sizes, alt = '', eager = false, ...rest }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? `/img/${name}.webp` : cdnImg(name, w)}
      srcSet={failed ? undefined : cdnSrcSet(name, widths)}
      sizes={failed ? undefined : sizes}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager ? 'high' : undefined}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
