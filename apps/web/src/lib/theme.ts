import { defaultUiSettings, type UiSettings } from '@gustopos/shared';

const themeVariableMap: Record<keyof UiSettings['theme'], string> = {
  primary: '--color-primary',
  secondary: '--color-secondary',
  accent: '--color-accent',
  success: '--color-success',
  warning: '--color-warning',
  danger: '--color-danger',
  bg: '--color-bg',
  border: '--color-border',
  textMain: '--color-text-main',
  textMuted: '--color-text-muted',
};

export function applyUiTheme(settings?: UiSettings | null) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const source = settings?.theme ?? defaultUiSettings.theme;

  (Object.keys(themeVariableMap) as Array<keyof UiSettings['theme']>).forEach((token) => {
    root.style.setProperty(themeVariableMap[token], source[token]);
  });
}
