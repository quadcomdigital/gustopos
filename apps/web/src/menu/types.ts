import type { ConsumerUser, PublicMenuResponse, PublicMenuModuleConfig } from '@gustopos/shared';

/**
 * A cart line as shown to the public. Mirrors the API's `publicOrderLineSchema`
 * selections so the server can re-price authoritatively at submit time.
 */
export type PublicCartLine = {
  id: string;
  name: string;
  /** Base menu price (without modifiers). */
  basePrice: number;
  /** Sum of the selected modifier deltas (client-side preview only). */
  modifierPriceDelta: number;
  quantity: number;
  category: string;
  ingredients: string[];
  isSoldOut?: boolean;
  isFeatured?: boolean;
  notes?: string;
  selectedModifiers: Array<{ groupId: string; optionId: string }>;
};

export type MenuSectionId = PublicMenuModuleConfig['sections'][number]['id'];

/**
 * Brand surfaces a tenant scaffold may contribute. Pure data: the shared
 * appearance builder never learns which tenant set them, it only merges them.
 */
export type PublicBrandOverride = {
  /** Accent used as a fill (buttons, active chips, progress). */
  accent?: string;
  /** Dark chrome (header, drawer header, hero). */
  ink?: string;
  inkSoft?: string;
  /** Light content canvas. */
  pageBg?: string;
  surface?: string;
  border?: string;
  muted?: string;
  /** Logo URL; a scaffold ships its own local asset instead of a remote one. */
  logoUrl?: string;
};

export type MenuAppearance = {
  /** Brand accent used as a FILL (buttons, active chips, progress). */
  accent: string;
  /** Text/icon colour to place ON the accent fill. */
  accentForeground: string;
  /** Accent darkened so it is readable when used AS text on light surfaces. */
  accentText: string;
  /** Accent hover/pressed state. */
  accentStrong: string;
  /** Tinted accent surface for badges and soft highlights. */
  accentSoft: string;
  /** Dark chrome (header, drawer header, hero). */
  ink: string;
  inkSoft: string;
  /** Light content canvas. */
  pageBg: string;
  surface: string;
  border: string;
  muted: string;
  currency: string;
  preset: PublicMenuModuleConfig['preset'];
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  showPrices: boolean;
  showIngredients: boolean;
};

/** Data + config a shell needs to render (immutable per fetch). */
export type MenuShellData = {
  menu: PublicMenuResponse;
  config: PublicMenuModuleConfig;
  appearance: MenuAppearance;
  categories: Array<{ id: string; name: string }>;
  filteredItems: PublicMenuResponse['items'];
  activeCategory: string;
  searchQuery: string;
  sectionOrder: MenuSectionId[];
  enabledSections: Set<MenuSectionId>;
  /**
   * Where the cart button lives: the shared floating pill, or inside the
   * scaffold's own chrome (the scaffold then calls `actions.openCart` itself).
   */
  cartAffordance: 'floating' | 'shell';
};

/** Actions/state a shell may drive. Kept intentionally small. */
export type MenuShellActions = {
  onSelectCategory: (categoryId: string) => void;
  onSearch: (query: string) => void;
  onAddItem: (item: PublicMenuResponse['items'][number]) => void;
  openCart: () => void;
  closeCart: () => void;
  cartOpen: boolean;
  cartCount: number;
  cartTotal: number;
  cartLines: PublicCartLine[];
  onIncrementLine: (lineId: string) => void;
  onDecrementLine: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  takeawayEnabled: boolean;
};

export type MenuShellProps = {
  data: MenuShellData;
  actions: MenuShellActions;
};

// ── Checkout / overlay contracts ─────────────────────────────────────────────
// The page owns all checkout state; overlays are pure views over this model, so
// a scaffold can re-skin them without duplicating the ordering logic.

export type CheckoutStep = 'cart' | 'customer' | 'confirm';

export type TakeawayConfig = {
  minOrderAmount: number;
  maxItems: number;
  pickupEtaRequired: boolean;
  allowNotes: boolean;
};

export type CartCustomerForm = {
  name: string;
  phone: string;
  pickupEta: string;
  notes: string;
  setName: (value: string) => void;
  setPhone: (value: string) => void;
  setPickupEta: (value: string) => void;
  setNotes: (value: string) => void;
};

export type CartAuthForm = {
  user: ConsumerUser | null;
  mode: 'login' | 'register';
  setMode: (mode: 'login' | 'register') => void;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  setFullName: (value: string) => void;
  setEmail: (value: string) => void;
  setPhone: (value: string) => void;
  setPassword: (value: string) => void;
  error: string;
  loading: boolean;
  submit: () => Promise<void>;
  logout: () => Promise<void>;
};

export type CartDrawerProps = {
  appearance: MenuAppearance;
  currency: string;
  formatPrice: (value: number) => string;
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  cart: PublicCartLine[];
  cartCount: number;
  cartTotal: number;
  checkoutStep: CheckoutStep;
  setCheckoutStep: (step: CheckoutStep) => void;
  onIncrement: (lineId: string) => void;
  onDecrement: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  optionNameById: Map<string, string>;
  takeawayConfig: TakeawayConfig;
  submitting: boolean;
  successId: string;
  submitError: string;
  blockedReason: string;
  onSubmit: () => void;
  customer: CartCustomerForm;
  auth: CartAuthForm;
};

export type ModifierSheetProps = {
  item: PublicMenuResponse['items'][number] | null;
  /** Category-level pools applying to this item's category. */
  categoryPools: PublicMenuResponse['categoryModifierPools'];
  appearance: MenuAppearance;
  currency: string;
  formatPrice: (value: number) => string;
  onClose: () => void;
  onConfirm: (payload: {
    selectedModifiers: Array<{ groupId: string; optionId: string }>;
    modifierPriceDelta: number;
  }) => void;
};
