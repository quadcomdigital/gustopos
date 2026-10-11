import { BadRequestException } from "@nestjs/common";
import type { ZodTypeAny } from "zod";

/**
 * Parses a request body against a shared contract, turning Zod failures into
 * a 400 with a readable message (the same pattern the hand-written handlers in
 * app.controller.ts use, without repeating the try/catch everywhere).
 */
export function parseBody<T extends ZodTypeAny>(schema: T, payload: unknown): T["_output"] {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
    throw new BadRequestException(`${path}${first?.message ?? "Invalid payload"}`);
  }
  return result.data;
}
