import logoWebp from './omni-restaurant-logo.webp';
import logoPng from './omni-restaurant-logo.png';
import logoLightWebp from './omni-restaurant-logo-light.webp';
import logoLightPng from './omni-restaurant-logo-light.png';

/**
 * OmniRestaurant wordmark.
 *
 * `dark` (default) is the regular navy/blue artwork for light surfaces; `light`
 * is the recolored variant for dark surfaces such as the backoffice header.
 * WebP is served first, with a PNG fallback for older engines.
 */
export default function AppLogo({
  variant = 'dark',
  className,
  alt = 'OmniRestaurant',
}: {
  variant?: 'dark' | 'light';
  className?: string;
  alt?: string;
}) {
  const webp = variant === 'light' ? logoLightWebp : logoWebp;
  const png = variant === 'light' ? logoLightPng : logoPng;
  return (
    <picture>
      <source srcSet={webp} type="image/webp" />
      <img src={png} alt={alt} className={className} draggable={false} />
    </picture>
  );
}
