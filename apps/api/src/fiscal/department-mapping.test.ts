import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fiscalDepartmentMappingHasErrors,
  nextFreeDepartmentNumber,
  resolveFiscalDepartment,
  validateFiscalDepartmentMapping,
  type FiscalDepartment,
} from "@gustopos/shared";
import {
  buildFiscalDepartmentBriefing,
  departmentMappingErrors,
  departmentsForProtocol,
  resolveFiscalSaleLines,
} from "./department-mapping";
import { getFiscalDialect } from "./dialects";

function department(overrides: Partial<FiscalDepartment> & { department: number }): FiscalDepartment {
  return {
    label: "",
    vatRate: null,
    kind: "unknown",
    categoryIds: [],
    isDefault: false,
    ...overrides,
  };
}

const MAPPING: FiscalDepartment[] = [
  department({ department: 1, label: "IVA 10 bene", vatRate: 10, kind: "good", categoryIds: ["cat-cucina", "cat-bevande"] }),
  department({ department: 4, label: "IVA 22 servizio", vatRate: 22, kind: "service", categoryIds: ["cat-servizi"] }),
];

test("risolve la riga di vendita sul reparto della sua categoria", () => {
  const resolution = resolveFiscalSaleLines(
    [
      { name: "Pizza", quantity: 2, price: 7.5, categoryId: "cat-cucina" },
      { name: "Servizio", quantity: 1, price: 3, categoryId: "cat-servizi" },
    ],
    MAPPING,
  );
  assert.equal(resolution.blocked, false);
  assert.deepEqual(resolution.warnings, []);
  assert.deepEqual(resolution.lines, [
    { department: 1, amountCents: 750, quantity: 2, description: "Pizza" },
    { department: 4, amountCents: 300, quantity: 1, description: "Servizio" },
  ]);
});

test("una categoria non mappata finisce sul reparto di ripiego, con avviso", () => {
  const withFallback = [...MAPPING, department({ department: 9, label: "Ripiego", isDefault: true })];
  const resolution = resolveFiscalSaleLines([{ name: "Gelato", quantity: 1, price: 2.5, categoryId: "cat-dolci" }], withFallback);
  assert.equal(resolution.blocked, false);
  assert.equal(resolution.lines[0]?.department, 9);
  assert.equal(resolution.warnings.length, 1);
  assert.match(resolution.warnings[0], /cat-dolci/);
});

test("senza ripiego l'emissione è bloccata e la categoria resta segnalata", () => {
  const resolution = resolveFiscalSaleLines(
    [
      { name: "Pizza", quantity: 1, price: 7.5, categoryId: "cat-cucina" },
      { name: "Gelato", quantity: 1, price: 2.5, categoryId: "cat-dolci" },
    ],
    MAPPING,
  );
  assert.equal(resolution.blocked, true);
  assert.deepEqual(resolution.unmappedCategories, ["cat-dolci"]);
  // La riga mappata resta utilizzabile: il chiamante decide se emettere il resto.
  assert.equal(resolution.lines.length, 1);
});

test("una riga senza categoria non può essere emessa alla cieca", () => {
  const resolution = resolveFiscalSaleLines([{ name: "Voce libera", quantity: 1, price: 1 }], MAPPING);
  assert.equal(resolution.blocked, true);
  assert.match(resolution.unmappedCategories[0], /senza categoria/);
});

test("con la mappa vuota nulla è emettibile (nessun reparto inventato)", () => {
  const resolution = resolveFiscalSaleLines([{ name: "Pizza", quantity: 1, price: 7.5, categoryId: "cat-cucina" }], []);
  assert.equal(resolution.blocked, true);
  assert.deepEqual(resolution.lines, []);
});

test("i reparti si leggono per protocollo: numerazioni diverse convivono", () => {
  const mappings = [
    { protocolId: "rch-walle" as const, departments: MAPPING },
    { protocolId: "print3rt" as const, departments: [department({ department: 20, label: "Print bene", categoryIds: ["cat-cucina"] })] },
  ];
  assert.equal(departmentsForProtocol(mappings, "rch-walle")[0]?.department, 1);
  assert.equal(departmentsForProtocol(mappings, "print3rt")[0]?.department, 20);
  assert.deepEqual(departmentsForProtocol(mappings, null), []);
  assert.deepEqual(departmentsForProtocol(mappings, "ditron"), []);
});

test("il briefing per l'agente porta protocollo, gate e reparti ordinati", () => {
  const dialect = getFiscalDialect("rch-walle");
  const briefing = buildFiscalDepartmentBriefing({
    protocolId: dialect.id,
    requiresAgentVersion: dialect.requiresAgentVersion,
    departments: [...MAPPING, department({ department: 9, label: "Ripiego", isDefault: true })],
  });
  assert.equal(briefing.protocolId, "rch-walle");
  assert.equal(briefing.requiresAgentVersion, "go-0.15.0");
  assert.equal(briefing.defaultDepartment, 9);
  assert.deepEqual(briefing.departments.map((entry) => entry.department), [1, 4, 9]);
  // Il briefing non deve contenere nessun codice di dialetto.
  const serialized = JSON.stringify(briefing);
  for (const code of ["=R", "=T", "=C", "<</?"]) {
    assert.equal(serialized.includes(code), false, `il briefing non deve contenere "${code}"`);
  }
});

test("validazione: reparto duplicato, categoria su due reparti e due ripieghi sono errori", () => {
  const duplicates = validateFiscalDepartmentMapping([
    department({ department: 1, label: "a", categoryIds: ["c1"] }),
    department({ department: 1, label: "b", categoryIds: ["c2"] }),
  ]);
  assert.equal(fiscalDepartmentMappingHasErrors(duplicates), true);
  assert.ok(duplicates.some((issue) => /duplicato/i.test(issue.message)));

  const doubleCategory = validateFiscalDepartmentMapping([
    department({ department: 1, label: "a", categoryIds: ["c1"] }),
    department({ department: 2, label: "b", categoryIds: ["c1"] }),
  ]);
  assert.equal(fiscalDepartmentMappingHasErrors(doubleCategory), true);
  assert.ok(doubleCategory.some((issue) => /più reparti/i.test(issue.message)));

  const twoDefaults = validateFiscalDepartmentMapping([
    department({ department: 1, label: "a", isDefault: true }),
    department({ department: 2, label: "b", isDefault: true }),
  ]);
  assert.equal(fiscalDepartmentMappingHasErrors(twoDefaults), true);
  assert.ok(twoDefaults.some((issue) => /ripiego/i.test(issue.message)));
});

test("validazione: aliquota mancante e reparto senza categorie sono avvisi, non errori", () => {
  const issues = validateFiscalDepartmentMapping([department({ department: 3, label: "Bar" })]);
  assert.equal(fiscalDepartmentMappingHasErrors(issues), false);
  assert.ok(issues.some((issue) => issue.level === "warning" && /IVA/.test(issue.message)));
  assert.ok(issues.some((issue) => issue.level === "warning" && /senza categorie/.test(issue.message)));
});

test("una mappa coerente non produce anomalie e il ripiego non è obbligatorio", () => {
  const issues = validateFiscalDepartmentMapping(
    MAPPING.map((entry) => ({ ...entry, vatRate: entry.vatRate ?? 22 })),
  );
  assert.deepEqual(issues, []);
  assert.equal(nextFreeDepartmentNumber(MAPPING), 2);
  assert.equal(nextFreeDepartmentNumber([department({ department: 1 }), department({ department: 2 })]), 3);
});

test("gli errori che bloccano il salvataggio portano il protocollo di appartenenza", () => {
  const errors = departmentMappingErrors([
    {
      protocolId: "rch-walle",
      departments: [
        department({ department: 1, label: "a", vatRate: 10, categoryIds: ["c1"] }),
        department({ department: 1, label: "b", vatRate: 10, categoryIds: ["c2"] }),
      ],
    },
    {
      protocolId: "print3rt",
      departments: [department({ department: 20, label: "print", vatRate: 22, categoryIds: ["c1"] })],
    },
  ]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].protocolId, "rch-walle");
  assert.equal(errors[0].department, 1);
  assert.match(errors[0].message, /duplicato/i);
  // Una mappa senza errori non produce nulla da segnalare al salvataggio.
  assert.deepEqual(departmentMappingErrors([{ protocolId: "print3rt", departments: MAPPING.map((entry) => ({ ...entry, vatRate: 22 })) }]), []);
  assert.deepEqual(departmentMappingErrors(undefined), []);
});

test("la risoluzione diretta distingue categoria e ripiego", () => {
  const withFallback = [...MAPPING, department({ department: 9, isDefault: true })];
  assert.deepEqual(resolveFiscalDepartment(withFallback, "cat-servizi"), { department: withFallback[1], matchedBy: "category" });
  assert.deepEqual(resolveFiscalDepartment(withFallback, "cat-ignota"), { department: withFallback[2], matchedBy: "default" });
  assert.deepEqual(resolveFiscalDepartment(MAPPING, "cat-ignota"), { department: null, matchedBy: null });
  // Senza categoria non si indovina: si va al ripiego solo se esiste.
  assert.deepEqual(resolveFiscalDepartment(withFallback, null), { department: withFallback[2], matchedBy: "default" });
});
