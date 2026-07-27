const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

export function getRedisUrl(): string {
  return process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
}
