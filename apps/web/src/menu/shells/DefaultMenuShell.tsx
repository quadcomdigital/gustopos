import type { CSSProperties } from 'react';
import { Hero, CategoryNav, ItemGrid, FooterNote } from '../sections';
import type { MenuShellProps, MenuSectionId } from '../types';

/**
 * Default menu shell: a section-driven layout shared by every tenant unless a
 * per-tenant scaffold overrides it. Section order/visibility come from the
 * normalised config so the tenant can re-order blocks without code changes.
 *
 * Brand tokens are published as CSS variables so focus rings inside the shell
 * can follow the tenant accent without inline styles.
 */
export default function DefaultMenuShell({ data, actions }: MenuShellProps) {
  const headerSections: MenuSectionId[] = ['hero', 'categories_nav'];
  const orderedHeader = data.sectionOrder.filter((id) => headerSections.includes(id) && data.enabledSections.has(id));
  const orderedBody = data.sectionOrder.filter((id) => !headerSections.includes(id) && data.enabledSections.has(id));

  const rootStyle = {
    backgroundColor: data.appearance.pageBg,
    '--brand-accent': data.appearance.accent,
    '--brand-on-accent': data.appearance.accentForeground,
    '--brand-ink': data.appearance.ink,
  } as CSSProperties;

  return (
    <div className="min-h-[100dvh]" style={rootStyle}>
      <header
        className="sticky top-0 z-30 border-b px-4 pb-4 pt-6 md:px-6"
        style={{ backgroundColor: data.appearance.surface, borderColor: data.appearance.border }}
      >
        <div className="mx-auto max-w-7xl">
          {orderedHeader.map((id) => {
            if (id === 'hero') return <Hero key={id} data={data} onSearch={actions.onSearch} />;
            if (id === 'categories_nav') {
              return <CategoryNav key={id} data={data} onSelectCategory={actions.onSelectCategory} />;
            }
            return null;
          })}
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 md:p-8">
        {orderedBody.map((id) => {
          if (id === 'item_grid') return <ItemGrid key={id} data={data} actions={actions} />;
          if (id === 'footer_note') return <FooterNote key={id} data={data} />;
          return null;
        })}
      </div>
    </div>
  );
}
