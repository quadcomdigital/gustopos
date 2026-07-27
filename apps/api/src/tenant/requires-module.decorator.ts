import { SetMetadata } from "@nestjs/common";
import type { ModuleKey } from "@gustopos/shared";

export const REQUIRED_MODULE_KEY = "required_module_key";

export const RequiresModule = (moduleKey: ModuleKey) => SetMetadata(REQUIRED_MODULE_KEY, moduleKey);
