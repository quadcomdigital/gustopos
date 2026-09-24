/** Pure display helpers shared by every shell/scaffold. */

export function formatPrice(currency: string, value: number): string {
  const code = currency.toUpperCase();
  if (code === 'EUR') return `EUR ${value.toFixed(2)}`;
  return `${code} ${value.toFixed(2)}`;
}

const ICON_BY_KEY: Record<string, string> = {
  antipast: '🥗',
  dolc: '🍰',
  bevand: '🥤',
  drink: '🍹',
  vino: '🍷',
  primi: '🍝',
  second: '🍖',
};

export function categoryEmoji(name: string): string {
  const key = name.toLowerCase();
  for (const [needle, emoji] of Object.entries(ICON_BY_KEY)) {
    if (key.includes(needle)) return emoji;
  }
  return '🍽️';
}

const IT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const IT_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

/** Formats a `datetime-local` value as "Lun 5 Mag, 19:30". */
export function formatDatetimeLocal(value: string): string {
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return value;
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${IT_DAYS[date.getDay()]} ${d} ${IT_MONTHS[m - 1]}, ${timePart}`;
}
