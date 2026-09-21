import type { ModuleKey } from "@gustopos/shared";

/**
 * Two modules that cannot be enabled at the same time. Enabling one disables
 * the other (and, transitively, everything that depends on it).
 */
export const MUTUALLY_EXCLUSIVE_MODULES: Array<[ModuleKey, ModuleKey]> = [
  ["inventory", "simple_catalog"],
];

/**
 * [child, parent]: the child cannot operate without the parent. Disabling a
 * parent cascades to its children — including when the parent is disabled as a
 * side effect of mutual exclusion (e.g. enabling `simple_catalog` disables
 * `inventory`, which in turn disables `purchasing_suppliers`). Enabling a child
 * auto-enables its parent chain.
 */
export const MODULE_DEPENDENCIES: Array<[ModuleKey, ModuleKey]> = [
  ["loyalty_points", "customers"],
  ["purchasing_suppliers", "inventory"],
  ["course_rounds", "kitchen"],
];

export interface ModuleTogglePlan {
  enable: ModuleKey[];
  disable: ModuleKey[];
}

/**
 * Pure planner for a module toggle. Given the current enabled state through
 * `isEnabled`, it computes which modules must be enabled/disabled so the
 * mutual-exclusion and dependency rules stay consistent.
 *
 * The explicitly toggled module is never reported in the opposite list:
 * - enabling X returns X (and required ancestors) in `enable`;
 * - disabling X returns the cascaded descendants in `disable`, not X itself.
 */
export function planModuleToggle(input: {
  moduleKey: ModuleKey;
  enabled: boolean;
  isEnabled: (key: ModuleKey) => boolean;
}): ModuleTogglePlan {
  const enable = new Set<ModuleKey>();
  const disable = new Set<ModuleKey>();

  // Effective state: planned changes win over the persisted state.
  const effective = (key: ModuleKey): boolean => {
    if (enable.has(key)) return true;
    if (disable.has(key)) return false;
    return input.isEnabled(key);
  };

  const disableCascade = (key: ModuleKey): void => {
    disable.add(key);
    for (const [child, parent] of MODULE_DEPENDENCIES) {
      if (parent === key && effective(child)) {
        disableCascade(child);
      }
    }
  };

  const enableAncestors = (key: ModuleKey): void => {
    for (const [child, parent] of MODULE_DEPENDENCIES) {
      if (child === key && !effective(parent)) {
        enable.add(parent);
        enableAncestors(parent);
      }
    }
  };

  if (input.enabled) {
    enable.add(input.moduleKey);
    for (const [first, second] of MUTUALLY_EXCLUSIVE_MODULES) {
      const opposite = input.moduleKey === first ? second : input.moduleKey === second ? first : null;
      if (opposite && effective(opposite)) {
        disableCascade(opposite);
      }
    }
    enableAncestors(input.moduleKey);
  } else {
    addDescendantsToDisable(input.moduleKey, disable, effective);
  }

  return {
    enable: [...enable],
    disable: [...disable],
  };
}

function addDescendantsToDisable(
  key: ModuleKey,
  disable: Set<ModuleKey>,
  effective: (key: ModuleKey) => boolean,
): void {
  for (const [child, parent] of MODULE_DEPENDENCIES) {
    if (parent !== key) continue;
    if (effective(child)) {
      disable.add(child);
      addDescendantsToDisable(child, disable, effective);
    }
  }
}
