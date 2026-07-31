// ESLint v9 Flat Config for GustoPOS web app (React 19 + Vite + TypeScript)
// Replaces the legacy typecheck-only setup with proper lint rules covering:
//   - core JS correctness (js.configs.recommended)
//   - TypeScript correctness (typescript-eslint recommended)
//   - React hooks v7: rules-of-hooks / exhaustive-deps / refs / set-state-in-effect / purity / preserve-manual-memoization
//   - JSX accessibility (jsx-a11y recommended)
//   - unused-vars detection via @typescript-eslint/no-unused-vars (type-aware, manual fix via IDE)
//
// Run: `npm run lint:eslint` from apps/web, or `npm run lint:eslint` at repo root.
//
// Severity strategy:
//   - Tier-1 ERROR (fail CI): rules-of-hooks, exhaustive-deps, refs, no-undef
//   - Tier-2 WARN (visible, non-blocking): everything else (recommended set downgraded)
//   - tsconfig flags noUnusedLocals/noUnusedParameters remain OFF to keep the iteration ESLint-only;
//     consider tightening once the 24 unused-var warnings are manually cleaned.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

/**
 * Helper: take an array of flat configs and downgrade every rule severity from
 * 'error' to 'warn'. Leaves 'off' alone. Arrays like ['error', {...opts}] become ['warn', {...opts}].
 */
const softRecommended = (configs) => configs.map((c) => ({
  ...c,
  rules: Object.fromEntries(
    Object.entries(c.rules ?? {}).map(([k, v]) => [k, Array.isArray(v) ? ['warn', ...v.slice(1)] : (v === 'off' ? 'off' : 'warn')]),
  ),
}));

export default [
  // 1. Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      'dist/**',
      'dist-ssr/**',
      'node_modules/**',
      '*.local',
      '.vite/**',
      'coverage/**',
      // Don't lint the config file itself
      'eslint.config.js',
      // Vendor / third-party bundles and service workers (not source code we maintain:
      // qz-tray.js is the QZ Tray client library, keepalive.worker.js is a service worker)
      'public/qz-tray.js',
      'public/keepalive.worker.js',
    ],
  },

  // 2. Base JS recommended (warn-level)
  ...softRecommended([js.configs.recommended]),

  // 3. TypeScript recommended (warn-level)
  ...softRecommended(tseslint.configs.recommended),

  // 4. Per-file overrides for .ts/.tsx/.jsx/.js in src/
  {
    files: ['src/**/*.{ts,tsx,jsx,js}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // ── Critical correctness rules: ERROR level (fails CI / blocks commits) ──
      'react-hooks/rules-of-hooks': 'error',               // never call hooks conditionally
      'react-hooks/exhaustive-deps': 'error',              // missing useEffect deps cause stale state
      'react-hooks/refs': 'error',                         // refs during render mask stale-closure bugs; opt-out via inline disable
      // no-undef: OFF. TypeScript's compiler already enforces undefined identifiers strictly
      // (including TS-only globals like RequestInit / EventListener / React with the new JSX
      // transform). Keeping eslint-plugin's no-undef on top produces false positives for
      // React 17+ JSX and TS-typed globals that ESLint cannot see via @typescript-eslint.
      'no-undef': 'off',
      'no-empty': 'warn',                                  // many intentional empty early-return blocks in this codebase

      // ── Unused vars: WARN (typescript-eslint, type-aware) ──
      // eslint-plugin-unused-imports was tried and removed: --fix didn't actually change files
      // in this flat-config + tseslint stack. Manual cleanup via IDE quick-fixes or `_`-prefix
      // is the current path. Consider re-introducing tsconfig flags once this category is at zero.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // ── React-hooks v7 (warn-level, surface for triage) ──
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/error-boundaries': 'warn',

      // ── TypeScript rules: warn-level for soft rollout ──
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // ── jsx-a11y: warn-level (downgraded for soft rollout) ──
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules ?? {}).map(([k]) => [k, 'warn']),
      ),

      // ── Loosen rules that produce noisy false positives in this codebase ──
      'jsx-a11y/anchor-is-valid': 'off',                    // we use buttons for navigation
    },
  },
];
