// ─── Text Normalizers ─────────────────────────────────────────────────────
// Extracted from app.repository.ts — pure string transforms.

export function normalizeCustomerName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeConsumerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeConsumerPhone(value: string): string {
  return value.replace(/\s+/g, "").replace(/[^+\d]/g, "").trim();
}
