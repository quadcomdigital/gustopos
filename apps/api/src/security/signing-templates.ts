/**
 * Rendering of the QZ Tray installer/diagnostics templates.
 *
 * The templates live in `apps/api/public/signing-templates/` (plain `.bat`,
 * `.ps1`, `.sh` files, easy to read and edit) and are rendered **per request**
 * with the tenant's own origin and the fingerprints the server currently
 * publishes. That is what removes the class of bug where a script shipped with
 * a baked-in SHA-1 (or another tenant's domain) silently installed a
 * certificate the server no longer served — the exact failure seen on site.
 *
 * Nothing secret is interpolated: only the public origin, the tenant slug, the
 * CN and the two SHA-1 fingerprints of material already served by
 * `/signing/digital-certificate.txt` and `/signing/override.crt`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const SIGNING_TEMPLATES = [
  "install-qz-cert.bat",
  "install-qz-cert.ps1",
  "install-qz-cert.sh",
  "debug-qz-cert.bat",
  "debug-qz-cert.ps1",
] as const;

export type SigningTemplateName = (typeof SIGNING_TEMPLATES)[number];

export interface SigningTemplateContext {
  /** Public origin of the tenant, e.g. `https://test.franksbar.it`. */
  origin: string;
  slug: string;
  cn: string;
  rootFingerprintSha1: string;
  leafFingerprintSha1: string;
}

export function isSigningTemplateName(name: string): name is SigningTemplateName {
  return (SIGNING_TEMPLATES as readonly string[]).includes(name);
}

/** `apps/api/public/signing-templates` from both `src/` and `dist/`. */
export function signingTemplateDir(): string {
  return join(__dirname, "..", "..", "public", "signing-templates");
}

const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g;

const CONTENT_TYPES: Record<SigningTemplateName, string> = {
  "install-qz-cert.bat": "application/octet-stream",
  "install-qz-cert.ps1": "text/plain; charset=utf-8",
  "install-qz-cert.sh": "text/x-shellscript; charset=utf-8",
  "debug-qz-cert.bat": "application/octet-stream",
  "debug-qz-cert.ps1": "text/plain; charset=utf-8",
};

export function signingTemplateContentType(name: SigningTemplateName): string {
  return CONTENT_TYPES[name];
}

/**
 * Fill every `{{PLACEHOLDER}}` of a template.
 *
 * Throws when a placeholder has no value: shipping a half-rendered installer
 * would put a literal `{{ROOT_SHA1}}` into a fingerprint comparison and fail
 * on the customer's machine with a confusing message.
 */
export function renderSigningTemplate(name: SigningTemplateName, ctx: SigningTemplateContext): string {
  const source = readFileSync(join(signingTemplateDir(), name), "utf-8");

  const values: Record<string, string> = {
    ORIGIN: ctx.origin,
    SLUG: ctx.slug,
    CN: ctx.cn,
    ROOT_SHA1: ctx.rootFingerprintSha1,
    LEAF_SHA1: ctx.leafFingerprintSha1,
  };

  const rendered = source.replace(PLACEHOLDER, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`unknown template placeholder {{${key}}} in ${name}`);
    if (!value.trim()) {
      // An empty value would silently install nothing (or compare against an
      // empty fingerprint and always fail on the customer's machine).
      throw new Error(`cannot render ${name}: placeholder ${key} is empty for tenant '${ctx.slug}'`);
    }
    return value;
  });

  const leftover = rendered.match(PLACEHOLDER);
  if (leftover) {
    throw new Error(`unrendered placeholder ${leftover[0]} remains in ${name}`);
  }
  return rendered;
}
