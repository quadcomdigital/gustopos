import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePrintAreas } from "./utils/json-parsers";

test("parsePrintAreas parses a valid legacy array", () => {
  assert.deepEqual(parsePrintAreas('["kitchen","bar"]'), ["kitchen", "bar"]);
});

test("parsePrintAreas does not fall back to kitchen for empty input", () => {
  assert.deepEqual(parsePrintAreas("[]"), []);
  assert.deepEqual(parsePrintAreas(null), []);
  assert.deepEqual(parsePrintAreas(undefined), []);
  assert.deepEqual(parsePrintAreas(""), []);
});

test("parsePrintAreas drops unknown values without inventing a station", () => {
  assert.deepEqual(parsePrintAreas('["bar","pizzeria","nope"]'), ["bar"]);
});

test("parsePrintAreas tolerates malformed JSON", () => {
  assert.deepEqual(parsePrintAreas("{not-json"), []);
});
