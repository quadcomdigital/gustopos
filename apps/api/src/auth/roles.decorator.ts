import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Array<"admin" | "waiter" | "chef" | "consumer">) => SetMetadata(ROLES_KEY, roles);
