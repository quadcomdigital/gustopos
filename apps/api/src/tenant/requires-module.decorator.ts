import { SetMetadata } from "@nestjs/common";
import type { ModuleKey } from "@gustopos/shared";

export const REQUIRED_MODULE_KEY = "required_module_key";
export const REQUIRED_ANY_OF_MODULES_KEY = "required_any_of_modules_key";

export const RequiresModule = (moduleKey: ModuleKey) => SetMetadata(REQUIRED_MODULE_KEY, moduleKey);

/**
 * Access passes when the tenant has AT LEAST ONE of the listed modules
 * enabled. Use it for shared surfaces (e.g. category modifier pools) that
 * both the `inventory` (Magazzino) and `simple_catalog` (Catalogo) modes
 * legitimately use — neither mode should see a 403 on a tab the UI shows.
 */
export const RequiresAnyOfModules = (...moduleKeys: ModuleKey[]) =>
  SetMetadata(REQUIRED_ANY_OF_MODULES_KEY, moduleKeys);
