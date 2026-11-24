/**
 * Formattazione importi per l'interfaccia italiana.
 *
 * Prima di questo helper ogni componente faceva `€{x.toFixed(2)}`: punto come
 * separatore decimale e nessun separatore delle migliaia ("€1234.50"). Su una
 * comanda o in cassa il formato corretto è "€1.234,50".
 *
 * Il simbolo resta in PREFISSO (come nel resto dell'app) per non cambiare il
 * layout dei bottoni e delle righe compatte.
 */
export function formatCurrency(value: number, options: { symbol?: string } = {}): string {
  const symbol = options.symbol ?? "€";
  // `Intl` gestisce arrotondamento a 2 decimali, separatori e raggruppamento.
  // `-0` va normalizzato: Intl formatterebbe "-0,00".
  const amount = Number.isFinite(value) ? value : 0;
  const negative = amount < 0 && !Object.is(amount, -0);
  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  // Negativo in prefisso: "-€4,20" è più leggibile di "€-4,20".
  return `${negative ? "-" : ""}${symbol}${formatted}`;
}
