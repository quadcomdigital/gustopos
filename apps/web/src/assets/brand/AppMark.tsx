import markWebp from './omni-mark.webp';
import markPng from './omni-mark.png';
import markLightWebp from './omni-mark-light.webp';
import markLightPng from './omni-mark-light.png';

/**
 * OmniRestaurant mark (icon only, transparent background) — the platform glyph
 * shown next to the venue's own brand name in the backoffice header.
 *
 * `dark` (default) is the navy/blue artwork for light surfaces; `light` is the
 * recolored variant for dark surfaces. WebP first, PNG fallback.
 */
export default function AppMark({
  variant = 'dark',
  className,
  alt = 'OmniRestaurant',
}: {
  variant?: 'dark' | 'light';
  className?: string;
  alt?: string;
}) {
  const webp = variant === 'light' ? markLightWebp : markWebp;
  const png = variant === 'light' ? markLightPng : markPng;
  return (
    <picture>
      <source srcSet={webp} type="image/webp" />
      <img src={png} alt={alt} className={className} draggable={false} />
    </picture>
  );
}
