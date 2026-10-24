import type { PublicMenuModuleConfig } from '@gustopos/shared';

/** How a shell lays out its dish cards. */
export type MenuItemLayout = 'rows' | 'cards';
/** Hero height: `tall` is the visual-forward variant used by `rich_visual`. */
export type MenuHeroHeight = 'compact' | 'tall';
/** Overall vertical rhythm inside the menu body. */
export type MenuDensity = 'compact' | 'comfortable';

/**
 * Preset-derived layout. `preset` is tenant-editable, so these choices are the
 * single source of truth every shell reads via `appearance.layout` — a shell
 * never branches on the preset string directly.
 */
export type MenuLayout = {
  itemLayout: MenuItemLayout;
  heroHeight: MenuHeroHeight;
  showHighlights: boolean;
  density: MenuDensity;
};

/**
 * The three shipped presets. Kept intentionally distinct so switching the preset
 * visibly changes the menu (card orientation, hero size, highlights, rhythm).
 */
export const PRESET_LAYOUTS: Record<PublicMenuModuleConfig['preset'], MenuLayout> = {
  // Menu-like, information-dense: compact rows, no highlights strip.
  minimal_elegant: { itemLayout: 'rows', heroHeight: 'compact', showHighlights: false, density: 'compact' },
  // Tile grid with a highlights strip, compact hero.
  modern_bistro: { itemLayout: 'cards', heroHeight: 'compact', showHighlights: true, density: 'comfortable' },
  // The visual-forward variant: tall hero + tile grid + highlights.
  rich_visual: { itemLayout: 'cards', heroHeight: 'tall', showHighlights: true, density: 'comfortable' },
};

export function resolveMenuLayout(preset: PublicMenuModuleConfig['preset']): MenuLayout {
  return PRESET_LAYOUTS[preset] ?? PRESET_LAYOUTS.minimal_elegant;
}
