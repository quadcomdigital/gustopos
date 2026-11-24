/**
 * Numero ticket dei conti non-dine-in. È anche il `number` del tavolo virtuale
 * su cui il conto vive, quindi due conti con lo stesso numero si fonderebbero.
 *
 * La versione precedente usava `Date.now().toString().slice(-4)`: quelle 4
 * cifre CICLANO OGNI 10 SECONDI, quindi due ordini a 10 s di distanza avevano
 * lo stesso numero. Qui l'entropia è reale (6 cifre casuali crittografiche):
 * la collisione intra-giorno passa da 1/10.000 a ~1/1.000.000 per coppia.
 *
 * Restano solo cifre per leggibilità al banco (il numero viene letto/ad alta
 * voce per chiamare il cliente).
 */

import crypto from "node:crypto";

export type TicketPrefix = "TA" | "DL" | "GR";

const TICKET_DIGITS = 6;

export function ticketDatePart(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * `digits` è iniettabile per i test; in produzione è sempre casuale.
 */
export function makeTicketNumber(
  prefix: TicketPrefix,
  options: { now?: Date; digits?: string } = {},
): string {
  const digits = options.digits ?? String(crypto.randomInt(0, 10 ** TICKET_DIGITS)).padStart(TICKET_DIGITS, "0");
  return `${prefix}-${ticketDatePart(options.now)}-${digits}`;
}
