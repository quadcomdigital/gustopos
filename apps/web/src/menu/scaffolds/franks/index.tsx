import type { CSSProperties } from 'react';
import type { MenuShellProps } from '../../types';
import { FranksFooter, FranksHero, FranksNav } from './components/FranksChrome';
import { FranksItemGrid } from './components/FranksItemGrid';

/**
 * Franks menu shell — the tenant's own layout. It deliberately shares nothing
 * with the default shell's components: the shared layer only hands it the data
 * contract (`MenuShellProps`) and the brand tokens, so nothing here can leak
 * back into another tenant's menu.
 */
export default function FranksMenuShell({ data, actions }: MenuShellProps) {
  const { appearance, enabledSections } = data;

  // Brand tokens published as CSS variables so focus rings and any CSS-only
  // states inside the scaffold stay on the same accent without inline styles.
  const rootStyle = {
    backgroundColor: appearance.pageBg,
    '--brand-accent': appearance.accent,
    '--brand-on-accent': appearance.accentForeground,
    '--brand-ink': appearance.ink,
    '--brand-border': appearance.border,
    '--brand-muted': appearance.muted,
  } as CSSProperties;

  return (
    <div className="min-h-[100dvh]" style={rootStyle}>
      {enabledSections.has('hero') && <FranksHero data={data} actions={actions} />}
      {enabledSections.has('categories_nav') && <FranksNav data={data} actions={actions} />}

      {enabledSections.has('item_grid') && (
        <main className="mx-auto max-w-6xl px-4 py-7 md:px-8 md:py-10">
          <FranksItemGrid data={data} actions={actions} />
        </main>
      )}

      {enabledSections.has('footer_note') && <FranksFooter data={data} />}
    </div>
  );
}
