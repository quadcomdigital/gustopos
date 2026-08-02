import { useEffect, useId, useMemo, useState } from 'react';
/* eslint-disable jsx-a11y/label-has-for -- file uses useId()-derived `fieldId('key')` helper for htmlFor. eslint-plugin-jsx-a11y cannot statically resolve CallExpression htmlFor values, producing false positives while the runtime DOM linkage is correct. Inputs also carry `aria-label`/`id` for defense-in-depth and the visible-or-sr-only label patterns correctly point at the control via the `htmlFor` expression. */
import { useNavigate } from 'react-router-dom';
import type {
  ModuleKey,
  RefreshResponse,
  SelfOrderSessionRotateResponse,
  SuperadminAuthResponse,
  Tenant,
  TenantModule,
} from '@gustopos/shared';
import ConfirmDialog from '../components/ConfirmDialog';
import { persistAuthSession } from '../shared/api/client';
import { setImpersonationSnapshot } from '../shared/auth/impersonation-snapshot';

const SUPERADMIN_TOKEN_KEY = 'gustopos:superadmin:token';
const SUPERADMIN_REFRESH_KEY = 'gustopos:superadmin:refresh';

const MODULES: Array<{ key: ModuleKey; label: string; description: string; critical?: boolean; requires?: ModuleKey[] }> = [
  { key: 'kitchen', label: 'Kitchen', description: 'Ordini cucina e flusso preparazione' },
  { key: 'inventory', label: 'Inventory', description: 'Magazzino, ingredienti e disponibilita', critical: true },
  { key: 'simple_catalog', label: 'Simple Catalog', description: 'Catalogo item semplificato senza ingredienti/BoM' },
  { key: 'customers', label: 'Customers', description: 'Anagrafica clienti e storico acquisti' },
  { key: 'analytics', label: 'Analytics', description: 'Report vendite, dashboard e KPI' },
  { key: 'printing', label: 'Printing', description: 'Stampa comande, ricevute e kitchen tickets', critical: true },
  { key: 'public_menu', label: 'Public Menu', description: 'Menu pubblico tenant su slug/subdomain' },
  { key: 'public_takeaway', label: 'Public Takeaway', description: 'Ordini takeaway dal menu pubblico (richiede Public Menu + Kitchen)' },
  { key: 'public_group_order', label: 'Public Group Order', description: 'Carrello condiviso pubblico con sessioni partecipanti (richiede Public Menu + Kitchen)' },
  { key: 'consumer_accounts', label: 'Consumer Accounts', description: 'Registrazione/login clienti consumer e storico ordini' },
  { key: 'loyalty_points', label: 'Loyalty Points', description: 'Programma punti cliente (richiede Customers)', requires: ['customers'] },
  { key: 'self_order_qr', label: 'Self Order QR', description: 'Ordine self-service via QR tavolo (richiede Public Menu)' },
  { key: 'reservations', label: 'Reservations', description: 'Prenotazioni tavoli e no-show tracking' },
  { key: 'delivery', label: 'Delivery', description: 'Consegne interne, ETA e stati ordine' },
  { key: 'purchasing_suppliers', label: 'Purchasing', description: 'Fornitori, ordini acquisto e ricezione parziale' },
  { key: 'staff_shifts_timeclock', label: 'Shifts', description: 'Pianificazione turni e timeclock con tolleranze' },
  { key: 'fiscal_exports', label: 'Fiscal Exports', description: 'Chiusura giorno ed export CSV fiscale' },
];

function getToken() {
  return localStorage.getItem(SUPERADMIN_TOKEN_KEY) ?? '';
}

function setSession(payload: SuperadminAuthResponse) {
  localStorage.setItem(SUPERADMIN_TOKEN_KEY, payload.token);
  localStorage.setItem(SUPERADMIN_REFRESH_KEY, payload.refreshToken);
}

function clearSession() {
  localStorage.removeItem(SUPERADMIN_TOKEN_KEY);
  localStorage.removeItem(SUPERADMIN_REFRESH_KEY);
}

async function superadminFetch(path: string, init?: RequestInit, retry = false) {
  const token = getToken();
  const response = await fetch(`/api/superadmin${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 && !retry) {
    const refreshToken = localStorage.getItem(SUPERADMIN_REFRESH_KEY);
    if (refreshToken) {
      const refreshed = await fetch('/api/superadmin/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshed.ok) {
        const payload = (await refreshed.json()) as SuperadminAuthResponse;
        setSession(payload);
        return superadminFetch(path, init, true);
      }
    }
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Superadmin request failed');
  }

  return payload;
}

async function tenantAdminFetch(path: string, init?: RequestInit): Promise<unknown> {
  const token = localStorage.getItem('gustopos:token') ?? '';
  const tenantId = localStorage.getItem('gustopos:tenantId');
  if (!tenantId) {
    throw new Error('Tenant ID mancante. Effettua prima l\'impersonazione di un tenant.');
  }
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message ?? 'Tenant admin request failed');
  }
  return payload;
}

export default function SuperadminPage() {
  const navigate = useNavigate();
  const idPrefix = useId();
  const fieldId = (key: string) => `${idPrefix}-${key}`;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getToken()));

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modulesByTenant, setModulesByTenant] = useState<Record<string, TenantModule[]>>({});
  const [logs, setLogs] = useState<Array<{ id: string; event: string; actor: string; createdAt: string; tenantId?: string }>>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createSubdomain, setCreateSubdomain] = useState('');
  const [createDomain, setCreateDomain] = useState('');

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMenuBuilderOpen, setIsMenuBuilderOpen] = useState(false);
  const [designTenantId, setDesignTenantId] = useState('');
  const [designPreset, setDesignPreset] = useState<'minimal_elegant' | 'rich_visual' | 'modern_bistro'>('minimal_elegant');
  const [designLogoUrl, setDesignLogoUrl] = useState('');
  const [designHeroImageUrl, setDesignHeroImageUrl] = useState('');
  const [designTagline, setDesignTagline] = useState('');
  const [designCurrency, setDesignCurrency] = useState('EUR');
  const [designAccentColor, setDesignAccentColor] = useState('#0f172a');
  const [designShowIngredients, setDesignShowIngredients] = useState(true);
  const [designShowPrices, setDesignShowPrices] = useState(true);
  const [designCategoryOrderText, setDesignCategoryOrderText] = useState('');
  const [designHiddenCategoryIdsText, setDesignHiddenCategoryIdsText] = useState('');
  const [designFeaturedItemIdsText, setDesignFeaturedItemIdsText] = useState('');
  const [designSoldOutItemIdsText, setDesignSoldOutItemIdsText] = useState('');
  const [menuCatalogCategories, setMenuCatalogCategories] = useState<Array<{ id: string; name: string; isActive: boolean }>>([]);
  const [menuCatalogItems, setMenuCatalogItems] = useState<Array<{ id: string; name: string; categoryId?: string; category: string; isActive: boolean }>>([]);
  const [bulkModuleKey, setBulkModuleKey] = useState<ModuleKey>('inventory');
  const [bulkEnable, setBulkEnable] = useState<'on' | 'off'>('off');
  const [selfOrderTableId, setSelfOrderTableId] = useState('');
  const [selfOrderQrResult, setSelfOrderQrResult] = useState<SelfOrderSessionRotateResponse | null>(null);
  const [takeawayTenantId, setTakeawayTenantId] = useState('');
  const [takeawayMinOrderAmount, setTakeawayMinOrderAmount] = useState('0');
  const [takeawayMaxItems, setTakeawayMaxItems] = useState('20');
  const [takeawayEtaRequired, setTakeawayEtaRequired] = useState(false);
  const [takeawayAllowNotes, setTakeawayAllowNotes] = useState(true);
  const [loyaltyTenantId, setLoyaltyTenantId] = useState('');
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState('1');
  const [loyaltyRedeemRate, setLoyaltyRedeemRate] = useState('100');
  const [loyaltyMinRedeemPoints, setLoyaltyMinRedeemPoints] = useState('100');

  const [lastChange, setLastChange] = useState<
    | { type: 'module'; tenantId: string; moduleKey: ModuleKey; previousEnabled: boolean }
    | { type: 'tenant'; tenantId: string; previousActive: boolean }
    | null
  >(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [impersonatingTenantId, setImpersonatingTenantId] = useState<string | null>(null);
  // UX-005: contextual action menu on the mobile tenant cards (kebab → sheet).
  const [cardMenuTenantId, setCardMenuTenantId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [criticalToggle, setCriticalToggle] = useState<{ tenantId: string; moduleKey: ModuleKey; enabled: boolean; label: string } | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId],
  );

  const selectedModules = useMemo(() => modulesByTenant[selectedTenantId] ?? [], [modulesByTenant, selectedTenantId]);
  const menuBuilderTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === designTenantId) ?? null,
    [tenants, designTenantId],
  );

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (statusFilter === 'active' && !tenant.isActive) return false;
      if (statusFilter === 'inactive' && tenant.isActive) return false;
      if (!q) return true;
      return (
        tenant.name.toLowerCase().includes(q) ||
        tenant.slug.toLowerCase().includes(q) ||
        (tenant.subdomain ?? '').toLowerCase().includes(q)
      );
    });
  }, [tenants, search, statusFilter]);

  async function load() {
    try {
      const nextTenants = (await superadminFetch('/tenants')) as Tenant[];
      setTenants(nextTenants);

      const moduleEntries = await Promise.all(
        nextTenants.map(async (tenant) => {
          const modules = (await superadminFetch(`/tenants/${tenant.id}/modules`)) as TenantModule[];
          return [tenant.id, modules] as const;
        }),
      );
      setModulesByTenant(Object.fromEntries(moduleEntries));

      const auditLogs = (await superadminFetch('/audit-logs')) as Array<{ id: string; event: string; actor: string; createdAt: string; tenantId?: string }>;
      setLogs(auditLogs);

      if (!selectedTenantId && nextTenants.length > 0) {
        setSelectedTenantId(nextTenants[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Errore caricamento superadmin');
      setIsAuthenticated(false);
    }
  }

  async function login() {
    try {
      setError('');
      const response = await fetch('/api/superadmin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as SuperadminAuthResponse;
      if (!response.ok) {
        throw new Error((payload as unknown as { message?: string }).message ?? 'Credenziali non valide');
      }

      setSession(payload);
      setPassword('');
      setIsAuthenticated(true);
      await load();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login error');
    }
  }

  async function logout() {
    try {
      await fetch('/api/superadmin/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });
    } finally {
      clearSession();
      setIsAuthenticated(false);
      setTenants([]);
      setModulesByTenant({});
      setLogs([]);
    }
  }

  async function createTenant() {
    try {
      setIsBusy(true);
      setError('');
      setSuccess('');

      await superadminFetch('/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: createName,
          slug: createSlug,
          ...(createSubdomain.trim() ? { subdomain: createSubdomain.trim() } : {}),
          ...(createDomain.trim() ? { domain: createDomain.trim() } : {}),
        }),
      });

      setSuccess(`Tenant '${createSlug}' creato con successo`);
      setCreateName('');
      setCreateSlug('');
      setCreateSubdomain('');
      setCreateDomain('');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Errore creazione tenant');
    } finally {
      setIsBusy(false);
    }
  }

  async function setTenantActive(tenant: Tenant, nextActive: boolean) {
    try {
      setIsBusy(true);
      setError('');
      setSuccess('');
      await superadminFetch(`/tenants/${tenant.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      setLastChange({ type: 'tenant', tenantId: tenant.id, previousActive: tenant.isActive });
      setSuccess(`Tenant '${tenant.slug}' ${nextActive ? 'attivato' : 'disattivato'}`);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Errore aggiornamento tenant');
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleModule(tenantId: string, moduleKey: ModuleKey, enabled: boolean, skipCriticalConfirm = false) {
    try {
      setIsBusy(true);
      setError('');
      setSuccess('');

      const meta = MODULES.find((entry) => entry.key === moduleKey);
      if (!enabled && meta?.critical && !skipCriticalConfirm) {
        setCriticalToggle({ tenantId, moduleKey, enabled, label: meta.label });
        return;
      }

      await superadminFetch(`/tenants/${tenantId}/modules/toggle`, {
        method: 'POST',
        body: JSON.stringify({ moduleKey, enabled }),
      });

      const previousEnabled = (modulesByTenant[tenantId] ?? []).find((entry) => entry.moduleKey === moduleKey)?.enabled ?? false;
      setLastChange({ type: 'module', tenantId, moduleKey, previousEnabled });

      const dependencyNote =
        enabled && moduleKey === 'self_order_qr'
          ? ' (dipendenza: public_menu ON richiesto)'
          : enabled && moduleKey === 'public_takeaway'
            ? ' (dipendenza: public_menu + kitchen ON richiesti)'
            : enabled && moduleKey === 'loyalty_points'
              ? ' (dipendenza: customers ON richiesto)'
              : !enabled && moduleKey === 'customers'
                ? ' (loyalty_points viene disabilitato)'
                : '';
      const mutualExclusionNote =
        enabled && (moduleKey === 'inventory' || moduleKey === 'simple_catalog')
          ? ` (mutua esclusione applicata: ${moduleKey === 'inventory' ? 'simple_catalog OFF' : 'inventory OFF'})`
          : '';
      setSuccess(`Modulo '${moduleKey}' ${enabled ? 'abilitato' : 'disabilitato'}${mutualExclusionNote}${dependencyNote}`);
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Errore toggle modulo');
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmCriticalToggle() {
    if (!criticalToggle) {
      return;
    }
    const { tenantId, moduleKey, enabled } = criticalToggle;
    setCriticalToggle(null);
    await toggleModule(tenantId, moduleKey, enabled, true);
  }

  async function applyBulkModuleChange() {
    try {
      setIsBusy(true);
      setError('');
      setSuccess('');
      const targets = filteredTenants;
      const targetEnabled = bulkEnable === 'on';

      await Promise.all(
        targets.map((tenant) =>
          superadminFetch(`/tenants/${tenant.id}/modules/toggle`, {
            method: 'POST',
            body: JSON.stringify({ moduleKey: bulkModuleKey, enabled: targetEnabled }),
          }),
        ),
      );

      setSuccess(
        `Modulo '${bulkModuleKey}' impostato ${targetEnabled ? 'ON' : 'OFF'} su ${targets.length} tenant filtrati`,
      );
      await load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'Errore bulk action moduli');
    } finally {
      setIsBusy(false);
    }
  }

  async function saveLoyaltyConfig() {
    if (!loyaltyTenantId) {
      setError('Seleziona un tenant per salvare la config loyalty');
      return;
    }
    const earnRate = Number(loyaltyEarnRate);
    const redeemRate = Number(loyaltyRedeemRate);
    const minRedeemPoints = Number(loyaltyMinRedeemPoints);
    if (!Number.isFinite(earnRate) || earnRate <= 0) {
      setError('Earn rate non valido');
      return;
    }
    if (!Number.isFinite(redeemRate) || redeemRate <= 0) {
      setError('Redeem rate non valido');
      return;
    }
    if (!Number.isFinite(minRedeemPoints) || minRedeemPoints < 0) {
      setError('Soglia minima redeem non valida');
      return;
    }
    try {
      setIsBusy(true);
      setError('');
      setSuccess('');
      await superadminFetch(`/tenants/${loyaltyTenantId}/modules/config`, {
        method: 'POST',
        body: JSON.stringify({
          moduleKey: 'loyalty_points',
          config: {
            earnRate,
            redeemRate,
            minRedeemPoints,
          },
        }),
      });
      const tenantSlug = tenants.find((tenant) => tenant.id === loyaltyTenantId)?.slug ?? loyaltyTenantId;
      setSuccess(`Config loyalty salvata per '${tenantSlug}'`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Errore salvataggio config loyalty');
    } finally {
      setIsBusy(false);
    }
  }

  async function loadLoyaltyConfig(tenantId: string) {
    setLoyaltyTenantId(tenantId);
    setLoyaltyEarnRate('1');
    setLoyaltyRedeemRate('100');
    setLoyaltyMinRedeemPoints('100');
    try {
      const configPayload = (await superadminFetch(`/tenants/${tenantId}/modules/config/loyalty_points`)) as {
        config?: Record<string, unknown>;
      };
      const config = configPayload?.config ?? {};
      if (typeof config.earnRate === 'number') setLoyaltyEarnRate(String(config.earnRate));
      if (typeof config.redeemRate === 'number') setLoyaltyRedeemRate(String(config.redeemRate));
      if (typeof config.minRedeemPoints === 'number') setLoyaltyMinRedeemPoints(String(config.minRedeemPoints));
    } catch {
      // keep defaults
    }
  }

  async function rotateSelfOrderQr() {
    try {
      setIsBusy(true);
      setError('');
      setSuccess('');
      setSelfOrderQrResult(null);

      const payload = (await tenantAdminFetch(`/self-order/tables/${encodeURIComponent(selfOrderTableId)}/qr/rotate`, {
        method: 'POST',
      })) as SelfOrderSessionRotateResponse;

      setSelfOrderQrResult(payload);
      setSuccess(`QR self-order rigenerato per tavolo ${payload.tableNumber}`);
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Errore rotazione QR self-order');
    } finally {
      setIsBusy(false);
    }
  }

  async function savePublicTakeawayConfig() {
    if (!takeawayTenantId) {
      setError('Seleziona un tenant per salvare la config public takeaway');
      return;
    }

    const minOrderAmount = Number(takeawayMinOrderAmount);
    const maxItems = Number(takeawayMaxItems);
    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      setError('Min order amount non valido');
      return;
    }
    if (!Number.isFinite(maxItems) || maxItems < 1) {
      setError('Max items non valido');
      return;
    }

    try {
      setIsBusy(true);
      setError('');
      setSuccess('');
      await superadminFetch(`/tenants/${takeawayTenantId}/modules/config`, {
        method: 'POST',
        body: JSON.stringify({
          moduleKey: 'public_takeaway',
          config: {
            minOrderAmount,
            maxItems,
            pickupEtaRequired: takeawayEtaRequired,
            allowNotes: takeawayAllowNotes,
          },
        }),
      });

      const tenantSlug = tenants.find((tenant) => tenant.id === takeawayTenantId)?.slug ?? takeawayTenantId;
      setSuccess(`Config public takeaway salvata per '${tenantSlug}'`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Errore salvataggio config public takeaway');
    } finally {
      setIsBusy(false);
    }
  }

  async function loadPublicTakeawayConfig(tenantId: string) {
    setTakeawayTenantId(tenantId);
    setTakeawayMinOrderAmount('0');
    setTakeawayMaxItems('20');
    setTakeawayEtaRequired(false);
    setTakeawayAllowNotes(true);

    try {
      const configPayload = (await superadminFetch(`/tenants/${tenantId}/modules/config/public_takeaway`)) as {
        config?: Record<string, unknown>;
      };
      const config = configPayload?.config ?? {};
      if (typeof config.minOrderAmount === 'number') setTakeawayMinOrderAmount(String(config.minOrderAmount));
      if (typeof config.maxItems === 'number') setTakeawayMaxItems(String(config.maxItems));
      if (typeof config.pickupEtaRequired === 'boolean') setTakeawayEtaRequired(config.pickupEtaRequired);
      if (typeof config.allowNotes === 'boolean') setTakeawayAllowNotes(config.allowNotes);
    } catch {
      // keep defaults when no config exists
    }
  }

  async function undoLastChange() {
    if (!lastChange) {
      return;
    }

    try {
      setIsBusy(true);
      setError('');
      if (lastChange.type === 'module') {
        await superadminFetch(`/tenants/${lastChange.tenantId}/modules/toggle`, {
          method: 'POST',
          body: JSON.stringify({
            moduleKey: lastChange.moduleKey,
            enabled: lastChange.previousEnabled,
          }),
        });
      } else {
        await superadminFetch(`/tenants/${lastChange.tenantId}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: lastChange.previousActive }),
        });
      }

      setSuccess('Ultima modifica ripristinata');
      setLastChange(null);
      await load();
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Errore undo');
    } finally {
      setIsBusy(false);
    }
  }

  async function savePublicMenuDesign() {
    if (!designTenantId) {
      setError('Seleziona un tenant per salvare il design menu pubblico');
      return;
    }

    try {
      setIsBusy(true);
      setError('');
      setSuccess('');
      await superadminFetch(`/tenants/${designTenantId}/modules/config`, {
        method: 'POST',
        body: JSON.stringify({
          moduleKey: 'public_menu',
          config: {
            preset: designPreset,
            ...(designLogoUrl.trim() ? { logoUrl: designLogoUrl.trim() } : {}),
            ...(designHeroImageUrl.trim() ? { heroImageUrl: designHeroImageUrl.trim() } : {}),
            ...(designTagline.trim() ? { brandTagline: designTagline.trim() } : {}),
            showIngredients: designShowIngredients,
            showPrices: designShowPrices,
            currency: designCurrency.trim() || 'EUR',
            accentColor: designAccentColor,
            categoryOrder: designCategoryOrderText
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
            hiddenCategoryIds: designHiddenCategoryIdsText
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
            featuredItemIds: designFeaturedItemIdsText
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
            soldOutItemIds: designSoldOutItemIdsText
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean),
          },
        }),
      });

      const targetSlug = tenants.find((tenant) => tenant.id === designTenantId)?.slug ?? designTenantId;
      setSuccess(`Public menu design salvato per '${targetSlug}' (preset: ${designPreset})`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Errore salvataggio design menu');
    } finally {
      setIsBusy(false);
    }
  }

  function resetMenuBuilderToDefaults() {
    setDesignPreset('minimal_elegant');
    setDesignLogoUrl('');
    setDesignHeroImageUrl('');
    setDesignTagline('');
    setDesignCurrency('EUR');
    setDesignAccentColor('#0f172a');
    setDesignShowIngredients(true);
    setDesignShowPrices(true);
    setDesignCategoryOrderText('');
    setDesignHiddenCategoryIdsText('');
    setDesignFeaturedItemIdsText('');
    setDesignSoldOutItemIdsText('');
  }

  async function openMenuBuilder(tenantId: string) {
    setError('');
    setSuccess('');
    setDesignTenantId(tenantId);
    resetMenuBuilderToDefaults();
    setIsMenuBuilderOpen(true);

    try {
      const catalogPayload = (await superadminFetch(`/tenants/${tenantId}/public-menu/catalog`)) as {
        categories?: Array<{ id: string; name: string; isActive: boolean }>;
        items?: Array<{ id: string; name: string; categoryId?: string; category: string; isActive: boolean }>;
      };
      setMenuCatalogCategories(catalogPayload.categories ?? []);
      setMenuCatalogItems(catalogPayload.items ?? []);

      const configPayload = (await superadminFetch(
        `/tenants/${tenantId}/modules/config/public_menu`,
      )) as { config?: Record<string, unknown> };
      const config = configPayload?.config ?? {};

      if (typeof config.preset === 'string' && ['minimal_elegant', 'rich_visual', 'modern_bistro'].includes(config.preset)) {
        setDesignPreset(config.preset as 'minimal_elegant' | 'rich_visual' | 'modern_bistro');
      }
      if (typeof config.logoUrl === 'string') setDesignLogoUrl(config.logoUrl);
      if (typeof config.heroImageUrl === 'string') setDesignHeroImageUrl(config.heroImageUrl);
      if (typeof config.brandTagline === 'string') setDesignTagline(config.brandTagline);
      if (typeof config.currency === 'string') setDesignCurrency(config.currency);
      if (typeof config.accentColor === 'string') setDesignAccentColor(config.accentColor);
      if (typeof config.showIngredients === 'boolean') setDesignShowIngredients(config.showIngredients);
      if (typeof config.showPrices === 'boolean') setDesignShowPrices(config.showPrices);
      if (Array.isArray(config.categoryOrder)) setDesignCategoryOrderText(config.categoryOrder.filter((entry): entry is string => typeof entry === 'string').join(', '));
      if (Array.isArray(config.hiddenCategoryIds)) setDesignHiddenCategoryIdsText(config.hiddenCategoryIds.filter((entry): entry is string => typeof entry === 'string').join(', '));
      if (Array.isArray(config.featuredItemIds)) setDesignFeaturedItemIdsText(config.featuredItemIds.filter((entry): entry is string => typeof entry === 'string').join(', '));
      if (Array.isArray(config.soldOutItemIds)) setDesignSoldOutItemIdsText(config.soldOutItemIds.filter((entry): entry is string => typeof entry === 'string').join(', '));
    } catch {
      // No existing config for tenant: keep defaults
    }
  }

  function moveCategoryOrder(categoryId: string, direction: 'up' | 'down') {
    setDesignCategoryOrderText((current) => {
      const base = current
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      const seed = base.length > 0 ? base : menuCatalogCategories.map((entry) => entry.id);
      const index = seed.indexOf(categoryId);
      if (index === -1) {
        return seed.join(', ');
      }
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= seed.length) {
        return seed.join(', ');
      }
      const copy = [...seed];
      const [item] = copy.splice(index, 1);
      copy.splice(swapIndex, 0, item);
      return copy.join(', ');
    });
  }

  const parsedCategoryOrder = useMemo(
    () => designCategoryOrderText
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    [designCategoryOrderText],
  );

  function toggleIdInTextState(current: string, id: string): string {
    const entries = current
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.includes(id)) {
      return entries.filter((entry) => entry !== id).join(', ');
    }
    return [...entries, id].join(', ');
  }

  function readImageAsDataUrl(file: File, target: 'logo' | 'hero') {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      if (!value) {
        return;
      }
      if (target === 'logo') {
        setDesignLogoUrl(value);
      } else {
        setDesignHeroImageUrl(value);
      }
    };
    reader.readAsDataURL(file);
  }

  async function impersonateTenant(tenantId: string) {
    if (impersonatingTenantId) {
      return;
    }
    try {
      setImpersonatingTenantId(tenantId);
      setError('');
      setSuccess(`Avvio impersonazione tenant ${tenantId}...`);
      const payload = (await superadminFetch(`/tenants/${tenantId}/impersonate`, { method: 'POST' })) as RefreshResponse;

      setImpersonationSnapshot({
        superadminToken: localStorage.getItem(SUPERADMIN_TOKEN_KEY),
        superadminRefresh: localStorage.getItem(SUPERADMIN_REFRESH_KEY),
      });
      persistAuthSession(payload);
      navigate('/', { replace: true });
    } catch (impersonateError) {
      setError(impersonateError instanceof Error ? impersonateError.message : 'Impersonation fallita');
    } finally {
      setImpersonatingTenantId(null);
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps -- [load-recursion] load is recreated each render; effect only refreshes on auth transition */
  useEffect(() => {
    if (isAuthenticated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] load() calls setState() asyncronously
      void load();
    }
  }, [isAuthenticated]);
  /* eslint-enable react-hooks/exhaustive-deps */

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
        <section className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800">Superadmin Login</h1>
          <p className="text-xs text-slate-500">Accesso master per gestione tenant e moduli.</p>
          <label htmlFor={fieldId('login-username')} className="sr-only">Username</label>
          <input
            id={fieldId('login-username')}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            aria-label="Username"
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
          <label htmlFor={fieldId('login-password')} className="sr-only">Password</label>
          <input
            id={fieldId('login-password')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Password"
            aria-label="Password"
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
          <button
            onClick={() => void login()}
            className="w-full px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
          >
            Login
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <section className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Superadmin Control Center</h1>
            <p className="text-xs text-slate-500">Gestione tenant e moduli con workflow rapido.</p>
          </div>
          <button
            onClick={() => void logout()}
            className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
          >
            Logout
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Crea Tenant</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <label htmlFor={fieldId('create-name')} className="sr-only">Nome tenant</label>
            <input id={fieldId('create-name')} value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Nome tenant" aria-label="Nome tenant" className="px-3 py-2 rounded border border-slate-300 text-sm" />
            <label htmlFor={fieldId('create-slug')} className="sr-only">Slug</label>
            <input id={fieldId('create-slug')} value={createSlug} onChange={(event) => setCreateSlug(event.target.value)} placeholder="slug" aria-label="Slug" className="px-3 py-2 rounded border border-slate-300 text-sm" />
            <label htmlFor={fieldId('create-subdomain')} className="sr-only">Subdomain</label>
            <input id={fieldId('create-subdomain')} value={createSubdomain} onChange={(event) => setCreateSubdomain(event.target.value)} placeholder="subdomain" aria-label="Subdomain" className="px-3 py-2 rounded border border-slate-300 text-sm" />
            <label htmlFor={fieldId('create-domain')} className="sr-only">Domain</label>
            <input id={fieldId('create-domain')} value={createDomain} onChange={(event) => setCreateDomain(event.target.value)} placeholder="domain (optional)" aria-label="Domain (optional)" className="px-3 py-2 rounded border border-slate-300 text-sm" />
          </div>
          <button
            onClick={() => void createTenant()}
            disabled={isBusy || !createName.trim() || !createSlug.trim()}
            className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Crea tenant
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Bulk Module Actions</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <label htmlFor={fieldId('bulk-module-key')} className="sr-only">Modulo</label>
            <select
              id={fieldId('bulk-module-key')}
              value={bulkModuleKey}
              onChange={(event) => setBulkModuleKey(event.target.value as ModuleKey)}
              aria-label="Modulo da configurare in bulk"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            >
              {MODULES.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </select>
            <label htmlFor={fieldId('bulk-enable')} className="sr-only">Stato</label>
            <select
              id={fieldId('bulk-enable')}
              value={bulkEnable}
              onChange={(event) => setBulkEnable(event.target.value as 'on' | 'off')}
              aria-label="Stato modulo (ON o OFF)"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            >
              <option value="on">Set ON</option>
              <option value="off">Set OFF</option>
            </select>
            <div className="md:col-span-2">
              <button
                onClick={() => setConfirmBulkOpen(true)}
                disabled={isBusy || filteredTenants.length === 0}
                className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Applica su {filteredTenants.length} tenant filtrati
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Loyalty Points Config</p>
          <p className="text-xs text-slate-500">Configura regole base earn/redeem per tenant con modulo <code>loyalty_points</code>.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <label htmlFor={fieldId('loyalty-tenant')} className="sr-only">Tenant loyalty</label>
            <select
              id={fieldId('loyalty-tenant')}
              value={loyaltyTenantId}
              onChange={(event) => {
                const nextId = event.target.value;
                if (nextId) {
                  void loadLoyaltyConfig(nextId);
                } else {
                  setLoyaltyTenantId('');
                }
              }}
              aria-label="Tenant loyalty"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            >
              <option value="">Seleziona tenant</option>
              {tenants.map((tenant) => (
                <option key={`loyalty-tenant-${tenant.id}`} value={tenant.id}>{tenant.slug}</option>
              ))}
            </select>
            <label htmlFor={fieldId('loyalty-earn-rate')} className="sr-only">Earn rate</label>
            <input
              id={fieldId('loyalty-earn-rate')}
              value={loyaltyEarnRate}
              onChange={(event) => setLoyaltyEarnRate(event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Earn rate (pt per EUR)"
              aria-label="Earn rate (punti per EUR)"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <label htmlFor={fieldId('loyalty-redeem-rate')} className="sr-only">Redeem rate</label>
            <input
              id={fieldId('loyalty-redeem-rate')}
              value={loyaltyRedeemRate}
              onChange={(event) => setLoyaltyRedeemRate(event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Redeem rate (pt per EUR)"
              aria-label="Redeem rate (punti per EUR)"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <label htmlFor={fieldId('loyalty-min-redeem')} className="sr-only">Soglia minima redeem</label>
            <input
              id={fieldId('loyalty-min-redeem')}
              value={loyaltyMinRedeemPoints}
              onChange={(event) => setLoyaltyMinRedeemPoints(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Soglia minima redeem"
              aria-label="Soglia minima redeem"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
          </div>
          <button
            onClick={() => void saveLoyaltyConfig()}
            disabled={isBusy || !loyaltyTenantId}
            className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Salva config loyalty
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Self Order QR (Tenant Admin)</p>
          <p className="text-xs text-slate-500">
            Richiede sessione impersonata tenant con moduli <code>self_order_qr</code> + <code>public_menu</code> attivi.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
            <label htmlFor={fieldId('self-order-table')} className="sr-only">Table ID</label>
            <input
              id={fieldId('self-order-table')}
              value={selfOrderTableId}
              onChange={(event) => setSelfOrderTableId(event.target.value)}
              placeholder="Table ID (es: t1)"
              aria-label="Table ID"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <button
              onClick={() => void rotateSelfOrderQr()}
              disabled={isBusy || !selfOrderTableId.trim()}
              className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              Rigenera QR
            </button>
          </div>
          {selfOrderQrResult && (
            <div className="text-xs text-slate-700 rounded border border-slate-200 p-3 bg-slate-50 space-y-1">
              <p><strong>Tavolo:</strong> {selfOrderQrResult.tableNumber}</p>
              <p><strong>Scadenza:</strong> {new Date(selfOrderQrResult.expiresAt).toLocaleString()}</p>
              <p><strong>URL:</strong> <a className="text-indigo-700 underline" href={selfOrderQrResult.publicUrl} target="_blank" rel="noreferrer">{selfOrderQrResult.publicUrl}</a></p>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Public Takeaway Config</p>
          <p className="text-xs text-slate-500">
            Dipende da moduli <code>public_takeaway</code> + <code>public_menu</code> + <code>kitchen</code>.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <label htmlFor={fieldId('takeaway-tenant')} className="sr-only">Tenant takeaway</label>
            <select
              id={fieldId('takeaway-tenant')}
              value={takeawayTenantId}
              onChange={(event) => {
                const nextId = event.target.value;
                if (nextId) {
                  void loadPublicTakeawayConfig(nextId);
                } else {
                  setTakeawayTenantId('');
                }
              }}
              aria-label="Tenant per public takeaway"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            >
              <option value="">Seleziona tenant</option>
              {tenants.map((tenant) => (
                <option key={`takeaway-tenant-${tenant.id}`} value={tenant.id}>{tenant.slug}</option>
              ))}
            </select>
            <label htmlFor={fieldId('takeaway-min-order')} className="sr-only">Min order</label>
            <input
              id={fieldId('takeaway-min-order')}
              value={takeawayMinOrderAmount}
              onChange={(event) => setTakeawayMinOrderAmount(event.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Min order (€)"
              aria-label="Min order amount in EUR"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <label htmlFor={fieldId('takeaway-max-items')} className="sr-only">Max items</label>
            <input
              id={fieldId('takeaway-max-items')}
              value={takeawayMaxItems}
              onChange={(event) => setTakeawayMaxItems(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Max items"
              aria-label="Max items consentiti per ordine"
              className="px-3 py-2 rounded border border-slate-300 text-sm"
            />
            <label htmlFor={fieldId('takeaway-eta-required')} className="flex items-center gap-2 px-3 py-2 rounded border border-slate-300 text-xs font-semibold">
              <input id={fieldId('takeaway-eta-required')} type="checkbox" aria-label="ETA required" checked={takeawayEtaRequired} onChange={(event) => setTakeawayEtaRequired(event.target.checked)} />
              ETA required
            </label>
            <label htmlFor={fieldId('takeaway-allow-notes')} className="flex items-center gap-2 px-3 py-2 rounded border border-slate-300 text-xs font-semibold">
              <input id={fieldId('takeaway-allow-notes')} type="checkbox" aria-label="Allow notes" checked={takeawayAllowNotes} onChange={(event) => setTakeawayAllowNotes(event.target.checked)} />
              Allow notes
            </label>
          </div>
          <button
            onClick={() => void savePublicTakeawayConfig()}
            disabled={isBusy || !takeawayTenantId}
            className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Salva config takeaway
          </button>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Tenants</p>
            <div className="flex gap-2">
              <label htmlFor={fieldId('search-tenant')} className="sr-only">Cerca tenant</label>
              <input
                id={fieldId('search-tenant')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca tenant"
                aria-label="Cerca tenant per nome, slug o subdomain"
                className="px-3 py-2 rounded border border-slate-300 text-sm"
              />
              <label htmlFor={fieldId('status-filter')} className="sr-only">Filtro stato tenant</label>
              <select
                id={fieldId('status-filter')}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                aria-label="Filtra per stato tenant"
                className="px-3 py-2 rounded border border-slate-300 text-sm"
              >
                <option value="all">Tutti</option>
                <option value="active">Solo attivi</option>
                <option value="inactive">Solo inattivi</option>
              </select>
            </div>
          </div>

          <div className="hidden md:block overflow-auto border border-slate-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-2 text-left">Tenant</th>
                  <th className="p-2 text-left">Slug</th>
                  <th className="p-2 text-left">Subdomain</th>
                  <th className="p-2 text-left">Stato</th>
                  <th className="p-2 text-left">Moduli ON</th>
                  <th className="p-2 text-left">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant) => {
                  const enabledCount = (modulesByTenant[tenant.id] ?? []).filter((entry) => entry.enabled).length;
                  return (
                    <tr key={tenant.id} className="border-t border-slate-100">
                      <td className="p-2 font-semibold text-slate-800">{tenant.name}</td>
                      <td className="p-2 text-slate-600">{tenant.slug}</td>
                      <td className="p-2 text-slate-600">{tenant.subdomain ?? '-'}</td>
                      <td className="p-2">
                        <span className={`font-semibold ${tenant.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tenant.isActive ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="p-2 text-slate-600">{enabledCount}/{MODULES.length}</td>
                      <td className="p-2 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setSelectedTenantId(tenant.id);
                            setIsDrawerOpen(true);
                          }}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold"
                        >
                          Moduli
                        </button>
                        <button
                          onClick={() => void setTenantActive(tenant, !tenant.isActive)}
                          className="px-2 py-1 rounded bg-slate-900 text-white font-semibold"
                          disabled={isBusy}
                        >
                          {tenant.isActive ? 'Disattiva' : 'Attiva'}
                        </button>
                        <button
                          type="button"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void impersonateTenant(tenant.id);
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void impersonateTenant(tenant.id);
                          }}
                          className="px-2 py-1 rounded border border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold"
                          disabled={Boolean(impersonatingTenantId)}
                        >
                          {impersonatingTenantId === tenant.id ? 'Accesso...' : 'Entra tenant'}
                        </button>
                        <button
                          onClick={() => void openMenuBuilder(tenant.id)}
                          className="px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-700 font-semibold"
                          disabled={isBusy}
                        >
                          Menu Builder
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-2">
            {filteredTenants.map((tenant) => {
              const enabledCount = (modulesByTenant[tenant.id] ?? []).filter((entry) => entry.enabled).length;
              return (
                <div key={`card-${tenant.id}`} className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{tenant.name}</p>
                      <p className="text-xs text-slate-500">{tenant.slug} • {tenant.subdomain ?? '-'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold ${tenant.isActive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tenant.isActive ? 'active' : 'inactive'}
                      </span>
                      <button
                        onClick={() => setCardMenuTenantId(cardMenuTenantId === tenant.id ? null : tenant.id)}
                        aria-label={`Azioni per ${tenant.name}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 active:bg-slate-50"
                      >
                        <span className="text-lg font-bold leading-none">⋯</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">Moduli ON: {enabledCount}/{MODULES.length}</p>
                  {/* Quick primary actions stay visible for one-tap tasks */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setSelectedTenantId(tenant.id);
                        setIsDrawerOpen(true);
                      }}
                      className="px-2 py-2 rounded border border-slate-300 bg-white text-slate-700 font-semibold text-xs min-h-[44px]"
                    >
                      Moduli
                    </button>
                    <button
                      onClick={() => void openMenuBuilder(tenant.id)}
                      className="px-2 py-2 rounded border border-amber-300 bg-amber-50 text-amber-700 font-semibold text-xs min-h-[44px]"
                      disabled={isBusy}
                    >
                      Menu Builder
                    </button>
                    <button
                      onClick={() => void setTenantActive(tenant, !tenant.isActive)}
                      className="px-2 py-2 rounded bg-slate-900 text-white font-semibold text-xs min-h-[44px] col-span-2"
                      disabled={isBusy}
                    >
                      {tenant.isActive ? 'Disattiva tenant' : 'Attiva tenant'}
                    </button>
                  </div>
                  {/* Contextual action sheet (UX-005): full actions in an overlay */}
                  {cardMenuTenantId === tenant.id && (
                    <div className="fixed inset-0 z-[1200] flex items-end">
                      <button
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setCardMenuTenantId(null)}
                        aria-label="Chiudi azioni"
                      />
                      <div className="relative w-full bg-white rounded-t-2xl border-t border-slate-200 shadow-2xl p-4 pb-6 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-bold text-slate-800">{tenant.name}</p>
                          <button
                            onClick={() => setCardMenuTenantId(null)}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-slate-200"
                            aria-label="Chiudi"
                          >
                            ✕
                          </button>
                        </div>
                        <button
                          type="button"
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setCardMenuTenantId(null);
                            void impersonateTenant(tenant.id);
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setCardMenuTenantId(null);
                            void impersonateTenant(tenant.id);
                          }}
                          className="w-full px-3 py-3.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold text-xs min-h-[48px]"
                          disabled={Boolean(impersonatingTenantId)}
                        >
                          {impersonatingTenantId === tenant.id ? 'Accesso...' : 'Entra tenant'}
                        </button>
                        <button
                          onClick={() => {
                            setCardMenuTenantId(null);
                            setSelectedTenantId(tenant.id);
                            setIsDrawerOpen(true);
                          }}
                          className="w-full px-3 py-3.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs min-h-[48px]"
                        >
                          Gestisci moduli
                        </button>
                        <button
                          onClick={() => {
                            setCardMenuTenantId(null);
                            void openMenuBuilder(tenant.id);
                          }}
                          className="w-full px-3 py-3.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 font-semibold text-xs min-h-[48px]"
                          disabled={isBusy}
                        >
                          Menu Builder
                        </button>
                        <button
                          onClick={() => {
                            setCardMenuTenantId(null);
                            void setTenantActive(tenant, !tenant.isActive);
                          }}
                          className="w-full px-3 py-3.5 rounded-lg border border-red-300 bg-red-50 text-red-700 font-semibold text-xs min-h-[48px]"
                          disabled={isBusy}
                        >
                          {tenant.isActive ? 'Disattiva tenant' : 'Attiva tenant'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Module Matrix</p>
          <div className="overflow-auto border border-slate-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-2 text-left">Tenant</th>
                  {MODULES.map((moduleMeta) => (
                    <th key={moduleMeta.key} className="p-2 text-left">{moduleMeta.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant) => (
                  <tr key={`matrix-${tenant.id}`} className="border-t border-slate-100">
                    <td className="p-2 font-semibold text-slate-800">{tenant.slug}</td>
                    {MODULES.map((moduleMeta) => {
                      const enabled = (modulesByTenant[tenant.id] ?? []).find((entry) => entry.moduleKey === moduleMeta.key)?.enabled ?? false;
                      return (
                        <td key={`${tenant.id}-${moduleMeta.key}`} className="p-2">
                          <button
                            onClick={() => void toggleModule(tenant.id, moduleMeta.key, !enabled)}
                            disabled={isBusy}
                            className={`px-2 py-1 rounded border font-semibold ${
                              enabled
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-slate-50 text-slate-600 border-slate-300'
                            }`}
                          >
                            {enabled ? 'ON' : 'OFF'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Audit Logs</p>
          <div className="max-h-64 overflow-auto border border-slate-200 rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-2 text-left">Evento</th>
                  <th className="p-2 text-left">Attore</th>
                  <th className="p-2 text-left">Tenant</th>
                  <th className="p-2 text-left">Quando</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="p-2">{entry.event}</td>
                    <td className="p-2">{entry.actor}</td>
                    <td className="p-2">{entry.tenantId ?? '-'}</td>
                    <td className="p-2">{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-emerald-600">{success}</p>
            {lastChange && (
              <button
                onClick={() => void undoLastChange()}
                disabled={isBusy}
                className="px-3 py-1 rounded border border-emerald-300 text-emerald-700 text-xs font-semibold disabled:opacity-50"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {isMenuBuilderOpen && menuBuilderTenant && (
        <div className="fixed inset-0 z-50 flex">
          <button className="flex-1 bg-black/40" onClick={() => setIsMenuBuilderOpen(false)} aria-label="Close menu builder" />
          <aside className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 p-5 overflow-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Public Menu Builder</p>
                <h2 className="text-lg font-bold text-slate-800">{menuBuilderTenant.name}</h2>
                <p className="text-xs text-slate-500">{menuBuilderTenant.slug}</p>
              </div>
              <button
                onClick={() => setIsMenuBuilderOpen(false)}
                className="px-3 py-1 rounded border border-slate-300 text-xs font-semibold"
              >
                Chiudi
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Designer (Preset: Minimal Elegante)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label htmlFor={fieldId('design-preset')} className="sr-only">Preset design menu pubblico</label>
                <select
                  id={fieldId('design-preset')}
                  value={designPreset}
                  onChange={(event) => setDesignPreset(event.target.value as 'minimal_elegant' | 'rich_visual' | 'modern_bistro')}
                  aria-label="Preset design menu pubblico"
                  className="px-3 py-2 rounded border border-slate-300 text-sm"
                >
                  <option value="minimal_elegant">Minimal Elegante</option>
                  <option value="rich_visual">Rich Visual</option>
                  <option value="modern_bistro">Modern Bistro</option>
                </select>
                <label htmlFor={fieldId('upload-logo')} className="px-3 py-2 rounded border border-slate-300 text-sm flex items-center justify-between gap-2 cursor-pointer">
                  <span>Upload logo</span>
                  <input
                    id={fieldId('upload-logo')}
                    type="file"
                    aria-label="Upload logo file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        readImageAsDataUrl(file, 'logo');
                      }
                    }}
                  />
                </label>
                <label htmlFor={fieldId('design-logo-url')} className="sr-only">Logo URL</label>
                <input
                  id={fieldId('design-logo-url')}
                  value={designLogoUrl}
                  onChange={(event) => setDesignLogoUrl(event.target.value)}
                  placeholder="Logo URL"
                  aria-label="Logo URL"
                  className="px-3 py-2 rounded border border-slate-300 text-sm"
                />
                <label htmlFor={fieldId('upload-hero')} className="px-3 py-2 rounded border border-slate-300 text-sm flex items-center justify-between gap-2 cursor-pointer">
                  <span>Upload hero</span>
                  <input
                    id={fieldId('upload-hero')}
                    type="file"
                    aria-label="Upload hero image file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        readImageAsDataUrl(file, 'hero');
                      }
                    }}
                  />
                </label>
                <label htmlFor={fieldId('design-hero-url')} className="sr-only">Hero image URL</label>
                <input
                  id={fieldId('design-hero-url')}
                  value={designHeroImageUrl}
                  onChange={(event) => setDesignHeroImageUrl(event.target.value)}
                  placeholder="Hero image URL"
                  aria-label="Hero image URL"
                  className="px-3 py-2 rounded border border-slate-300 text-sm"
                />
                <label htmlFor={fieldId('design-tagline')} className="sr-only">Tagline</label>
                <input
                  id={fieldId('design-tagline')}
                  value={designTagline}
                  onChange={(event) => setDesignTagline(event.target.value)}
                  placeholder="Tagline"
                  aria-label="Tagline brand"
                  className="px-3 py-2 rounded border border-slate-300 text-sm"
                />
                <label htmlFor={fieldId('design-currency')} className="sr-only">Currency</label>
                <input
                  id={fieldId('design-currency')}
                  value={designCurrency}
                  onChange={(event) => setDesignCurrency(event.target.value)}
                  placeholder="Currency (EUR)"
                  aria-label="Currency (EUR)"
                  className="px-3 py-2 rounded border border-slate-300 text-sm"
                />
                <label htmlFor={fieldId('design-category-order')} className="sr-only">Category order IDs</label>
                <input
                  id={fieldId('design-category-order')}
                  value={designCategoryOrderText}
                  onChange={(event) => setDesignCategoryOrderText(event.target.value)}
                  placeholder="Category order IDs (comma)"
                  aria-label="Category order IDs (CSV)"
                  className="px-3 py-2 rounded border border-slate-300 text-sm md:col-span-2"
                />
                <label htmlFor={fieldId('design-hidden-categories')} className="sr-only">Hidden category IDs</label>
                <input
                  id={fieldId('design-hidden-categories')}
                  value={designHiddenCategoryIdsText}
                  onChange={(event) => setDesignHiddenCategoryIdsText(event.target.value)}
                  placeholder="Hidden category IDs (comma)"
                  aria-label="Hidden category IDs (CSV)"
                  className="px-3 py-2 rounded border border-slate-300 text-sm md:col-span-2"
                />
                <label htmlFor={fieldId('design-featured-items')} className="sr-only">Featured item IDs</label>
                <input
                  id={fieldId('design-featured-items')}
                  value={designFeaturedItemIdsText}
                  onChange={(event) => setDesignFeaturedItemIdsText(event.target.value)}
                  placeholder="Featured item IDs (comma)"
                  aria-label="Featured item IDs (CSV)"
                  className="px-3 py-2 rounded border border-slate-300 text-sm md:col-span-2"
                />
                <label htmlFor={fieldId('design-sold-out-items')} className="sr-only">Sold out item IDs</label>
                <input
                  id={fieldId('design-sold-out-items')}
                  value={designSoldOutItemIdsText}
                  onChange={(event) => setDesignSoldOutItemIdsText(event.target.value)}
                  placeholder="Sold out item IDs (comma)"
                  aria-label="Sold out item IDs (CSV)"
                  className="px-3 py-2 rounded border border-slate-300 text-sm md:col-span-2"
                />
                <div className="flex items-center gap-2">
                  <label htmlFor={fieldId('design-accent-color')} className="sr-only">Accent color</label>
                  <input
                    id={fieldId('design-accent-color')}
                    type="color"
                    aria-label="Accent color"
                    value={designAccentColor}
                    onChange={(event) => setDesignAccentColor(event.target.value)}
                    className="h-9 w-14 rounded border border-slate-300"
                  />
                  <span className="text-xs text-slate-600 font-semibold">Accent color</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Category Ordering & Visibility</p>
                  <div className="space-y-2 max-h-56 overflow-auto">
                    {menuCatalogCategories.length === 0 && (
                      <p className="text-xs text-slate-500">Nessuna categoria menu disponibile.</p>
                    )}
                    {(parsedCategoryOrder.length > 0
                      ? [...menuCatalogCategories].sort((a, b) => {
                          const ai = parsedCategoryOrder.indexOf(a.id);
                          const bi = parsedCategoryOrder.indexOf(b.id);
                          const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
                          const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
                          return av - bv;
                        })
                      : menuCatalogCategories).map((category) => {
                      const hiddenEntries = designHiddenCategoryIdsText
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean);
                      const isHidden = hiddenEntries.includes(category.id);
                      return (
                        <div key={`builder-cat-${category.id}`} className="rounded border border-slate-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{category.name}</p>
                              <p className="text-[10px] text-slate-500">{category.id}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveCategoryOrder(category.id, 'up')}
                                className="px-2 py-1 rounded border border-slate-300 text-[10px] font-bold"
                              >
                                UP
                              </button>
                              <button
                                onClick={() => moveCategoryOrder(category.id, 'down')}
                                className="px-2 py-1 rounded border border-slate-300 text-[10px] font-bold"
                              >
                                DOWN
                              </button>
                            </div>
                          </div>
                          <label htmlFor={fieldId(`menu-cat-hide-${category.id}`)} className="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-700 font-semibold">
                            <input
                              id={fieldId(`menu-cat-hide-${category.id}`)}
                              type="checkbox"
                              aria-label={`Nascondi categoria ${category.name}`}
                              checked={isHidden}
                              onChange={() => setDesignHiddenCategoryIdsText((current) => toggleIdInTextState(current, category.id))}
                            />
                            Nascondi categoria
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Item Merchandising</p>
                  <div className="space-y-2 max-h-56 overflow-auto">
                    {menuCatalogItems.length === 0 && (
                      <p className="text-xs text-slate-500">Nessun item menu disponibile.</p>
                    )}
                    {menuCatalogItems.map((item) => {
                      const featuredEntries = designFeaturedItemIdsText
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean);
                      const soldOutEntries = designSoldOutItemIdsText
                        .split(',')
                        .map((entry) => entry.trim())
                        .filter(Boolean);
                      const isFeatured = featuredEntries.includes(item.id);
                      const isSoldOut = soldOutEntries.includes(item.id);
                      return (
                        <div key={`builder-item-${item.id}`} className="rounded border border-slate-200 bg-white p-2">
                          <p className="text-xs font-semibold text-slate-800">{item.name}</p>
                          <p className="text-[10px] text-slate-500">{item.id} • {item.category}</p>
                          <div className="mt-2 flex items-center gap-3">
                          <label htmlFor={fieldId(`menu-item-featured-${item.id}`)} className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                            <input
                              id={fieldId(`menu-item-featured-${item.id}`)}
                              type="checkbox"
                              aria-label={`Featured ${item.name}`}
                              checked={isFeatured}
                              onChange={() => setDesignFeaturedItemIdsText((current) => toggleIdInTextState(current, item.id))}
                            />
                            Featured
                          </label>
                          <label htmlFor={fieldId(`menu-item-soldout-${item.id}`)} className="inline-flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                            <input
                              id={fieldId(`menu-item-soldout-${item.id}`)}
                              type="checkbox"
                              aria-label={`Sold out ${item.name}`}
                              checked={isSoldOut}
                              onChange={() => setDesignSoldOutItemIdsText((current) => toggleIdInTextState(current, item.id))}
                            />
                            Sold out
                          </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label htmlFor={fieldId('design-show-ingredients')} className="inline-flex items-center gap-2 text-xs text-slate-700 font-semibold">
                  <input id={fieldId('design-show-ingredients')} type="checkbox" aria-label="Mostra ingredienti" checked={designShowIngredients} onChange={(event) => setDesignShowIngredients(event.target.checked)} />
                  Mostra ingredienti
                </label>            <label htmlFor={fieldId('design-show-prices')} className="inline-flex items-center gap-2 text-xs text-slate-700 font-semibold">
                  <input id={fieldId('design-show-prices')} type="checkbox" aria-label="Mostra prezzi" checked={designShowPrices} onChange={(event) => setDesignShowPrices(event.target.checked)} />
                  Mostra prezzi
                </label>
                <button
                  onClick={() => void savePublicMenuDesign()}
                  disabled={isBusy || !designTenantId}
                  className="px-4 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  Salva design menu
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Preview Desktop</p>
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    {designHeroImageUrl && (
                      <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${designHeroImageUrl})` }} />
                    )}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        {designLogoUrl && <img src={designLogoUrl} alt="Logo preview" className="h-6 w-6 rounded object-cover" />}
                        <h4 className="text-sm font-bold" style={{ color: designAccentColor }}>Brand Menu</h4>
                      </div>
                      <p className="text-xs text-slate-500">{designTagline || 'Tagline del menu pubblico'}</p>
                      <div className="text-xs text-slate-600">Preset: <strong>{designPreset}</strong></div>
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Preview Mobile</p>
                  <div className="mx-auto w-44 rounded-2xl border border-slate-300 bg-white p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {designLogoUrl && <img src={designLogoUrl} alt="Logo mobile preview" className="h-5 w-5 rounded object-cover" />}
                      <span className="text-xs font-bold" style={{ color: designAccentColor }}>Menu</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{designTagline || 'Tagline'}</div>
                    <div className="text-[10px] text-slate-600">Ingredienti: {designShowIngredients ? 'ON' : 'OFF'}</div>
                    <div className="text-[10px] text-slate-600">Prezzi: {designShowPrices ? 'ON' : 'OFF'}</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className={confirmBulkOpen ? 'block' : 'hidden'}>
        <div className="fixed inset-0 z-[70] bg-black/40" />
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-700">Conferma bulk action</h3>
            <p className="text-sm text-slate-600">
              Stai per impostare <strong>{bulkModuleKey}</strong> su <strong>{bulkEnable.toUpperCase()}</strong> per {filteredTenants.length} tenant filtrati.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmBulkOpen(false)}
                className="px-3 py-2 rounded border border-slate-300 text-xs font-bold uppercase tracking-wider"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  setConfirmBulkOpen(false);
                  void applyBulkModuleChange();
                }}
                className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      </div>

      {isDrawerOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 flex">
          <button className="flex-1 bg-black/40" onClick={() => setIsDrawerOpen(false)} aria-label="Close drawer" />
          <aside className="w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 p-5 overflow-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Manage Modules</p>
                <h2 className="text-lg font-bold text-slate-800">{selectedTenant.name}</h2>
                <p className="text-xs text-slate-500">{selectedTenant.slug}</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="px-3 py-1 rounded border border-slate-300 text-xs font-semibold"
              >
                Chiudi
              </button>
            </div>

            <div className="space-y-3">
              {MODULES.map((moduleMeta) => {
                const state = selectedModules.find((entry) => entry.moduleKey === moduleMeta.key);
                const enabled = state?.enabled ?? false;

                return (
                  <div key={moduleMeta.key} className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{moduleMeta.label}</p>
                      <p className="text-xs text-slate-500">{moduleMeta.description}</p>
                      {moduleMeta.critical && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mt-1">Modulo critico</p>
                      )}
                    </div>

                    <button
                      onClick={() => void toggleModule(selectedTenant.id, moduleMeta.key, !enabled)}
                      disabled={isBusy}
                      className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider border ${
                        enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-300'
                      } disabled:opacity-50`}
                    >
                      {enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(criticalToggle)}
        title="Conferma disattivazione modulo critico"
        message={
          criticalToggle
            ? `Stai per disattivare il modulo critico '${criticalToggle.label}'. Questa azione puo bloccare flussi operativi. Continuare?`
            : ''
        }
        confirmLabel="Disattiva"
        cancelLabel="Annulla"
        onCancel={() => setCriticalToggle(null)}
        onConfirm={() => void confirmCriticalToggle()}
      />
    </main>
  );
}
