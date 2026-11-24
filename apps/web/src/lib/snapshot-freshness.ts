/**
 * Uno snapshot REST può essere più vecchio di un push socket arrivato nel
 * frattempo (rete lenta, tab risvegliato, richiesta partita prima dell'evento).
 * Applicarlo comunque riporta il client a uno stato precedente: tavoli liberi
 * che sono occupati, totali sbagliati, finché non arriva l'evento successivo.
 *
 * Regola: la risposta REST si applica solo se NESSUN aggiornamento più recente
 * è stato applicato mentre la richiesta era in volo.
 */
export function shouldApplySnapshot(input: {
  /** `dataRevision` catturata prima di partire con la fetch. */
  capturedRevision: number;
  /** `dataRevision` corrente al ritorno della fetch. */
  currentRevision: number;
}): boolean {
  return input.capturedRevision === input.currentRevision;
}
