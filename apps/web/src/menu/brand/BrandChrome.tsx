import type { ReactNode } from 'react';
import type { PublicBrand } from './resolvePublicBrand';

/** Neutral chrome used before the brand payload has resolved. */
const FALLBACK_INK = '#0f172a';

/**
 * Shared dark chrome for the tenant surfaces that are not scaffold-driven
 * (group order, order tracking), so they read as the same product as the menu.
 * `brand` may be null while the menu payload is still loading; `name` keeps the
 * header meaningful in that window. When a logo is present the tenant name is
 * exposed to screen readers only, because the wordmark already carries it.
 */
export function BrandHeader({
  brand,
  name,
  action,
}: {
  brand: PublicBrand | null;
  name: string;
  action?: ReactNode;
}) {
  const ink = brand?.ink ?? FALLBACK_INK;
  const logoUrl = brand?.logoUrl;
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 backdrop-blur"
      style={{ backgroundColor: ink }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="h-8 w-auto shrink-0" />
        ) : (
          <p className="display text-base font-extrabold uppercase text-white">{name}</p>
        )}
        <span className="sr-only">{name}</span>
        <div className="ml-auto flex items-center gap-2">{action}</div>
      </div>
      {brand?.tagline && !logoUrl && (
        <p className="mx-auto max-w-3xl px-4 pb-3 text-xs text-white/55">{brand.tagline}</p>
      )}
    </header>
  );
}

export function BrandFooter({ brand, name }: { brand: PublicBrand | null; name: string }) {
  return (
    <footer
      className="mt-8 border-t"
      style={{ backgroundColor: brand?.ink ?? FALLBACK_INK, borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px]">
        <span className="font-semibold uppercase tracking-widest text-white/70">{name}</span>
        <span className="text-white/45">Menu digitale · ordina in autonomia</span>
      </div>
    </footer>
  );
}
