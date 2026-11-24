import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency } from "./currency";

test("usa la virgola decimale italiana", () => {
  assert.equal(formatCurrency(13), "€13,00");
  assert.equal(formatCurrency(6.5), "€6,50");
});

test("raggruppa le migliaia (soglia CLDR italiana: da 5 cifre)", () => {
  assert.equal(formatCurrency(12345.5), "€12.345,50");
  // it-IT non raggruppa i numeri a 4 cifre: è il comportamento CLDR corretto.
  assert.equal(formatCurrency(1234.5), "€1234,50");
});

test("arrotonda a due decimali", () => {
  assert.equal(formatCurrency(0.005), "€0,01");
  assert.equal(formatCurrency(2.345), "€2,35");
});

test("normalizza -0 e valori non finiti", () => {
  assert.equal(formatCurrency(-0), "€0,00");
  assert.equal(formatCurrency(Number.NaN), "€0,00");
});

test("gestisce gli importi negativi (resi/sconti)", () => {
  assert.equal(formatCurrency(-4.2), "-€4,20");
});

test("simbolo personalizzabile", () => {
  assert.equal(formatCurrency(3, { symbol: "EUR " }), "EUR 3,00");
});
