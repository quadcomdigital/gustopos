import { Suspense } from 'react';
import { resolveMenuScaffold } from './scaffolds';
import type { MenuShellProps } from './types';

/**
 * Dispatches rendering to the tenant scaffold (code) or the default shell.
 * Kept deliberately dumb: it holds no state, so scaffolds stay isolated from
 * orchestration (cart/checkout) which lives in the page.
 */
export default function MenuRenderer(props: MenuShellProps) {
  const Shell = resolveMenuScaffold(props.data.menu.scaffoldKey);
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-8 animate-pulse text-slate-500 text-sm">Caricamento menu...</div>
      }
    >
      <Shell {...props} />
    </Suspense>
  );
}
