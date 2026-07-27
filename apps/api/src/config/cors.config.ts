const DEFAULT_CORS_ORIGIN = "http://localhost:11900";

export function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return [DEFAULT_CORS_ORIGIN];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
