import { z } from "zod";

/** Per-tenant configuration for the course rounds module. */
export const courseRoundsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  labels: z.array(z.string().trim().min(1).max(80)).min(1).max(50).default([
    "1ª portata",
    "2ª portata",
    "3ª portata",
  ]),
  required: z.boolean().default(false),
});

export type CourseRoundsConfig = z.infer<typeof courseRoundsConfigSchema>;

/** Admin update payload for the course-rounds config (same shape as stored). */
export const courseRoundsConfigUpdateRequestSchema = courseRoundsConfigSchema;
export type CourseRoundsConfigUpdateRequest = z.infer<typeof courseRoundsConfigUpdateRequestSchema>;
