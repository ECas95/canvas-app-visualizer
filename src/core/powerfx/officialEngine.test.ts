import { describe, expect, it } from "vitest";
import type { Finding, FormulaRef } from "../../types/canvas";
import { findingsFromOfficialBatch, mergeOfficialPowerFxFindings, normalizeCanvasFormula } from "./officialEngine";

describe("normalizeCanvasFormula", () => {
  it("removes the Canvas source equals prefix", () => {
    expect(normalizeCanvasFormula("=If(true, 1, 2)")).toEqual({
      expression: "If(true, 1, 2)",
      offset: 1
    });
  });

  it("strips leading whitespace and maps parser spans back to Canvas source", () => {
    const formula = "  =Parent.Width - 24";
    const normalized = normalizeCanvasFormula(formula);
    expect(normalized).toEqual({
      expression: "Parent.Width - 24",
      offset: 3
    });
    expect(formula.slice(normalized.offset, normalized.offset + 6)).toBe(
      normalized.expression.slice(0, 6)
    );
  });

  it("handles multiline indentation before the serialized equals prefix", () => {
    const formula = "\n  =If(true, 1, 2)";
    const normalized = normalizeCanvasFormula(formula);
    expect(normalized).toEqual({ expression: "If(true, 1, 2)", offset: 4 });
    expect(formula.slice(normalized.offset)).toBe(normalized.expression);
  });

  it("leaves expressions without a Canvas source prefix unchanged", () => {
    expect(normalizeCanvasFormula("If(true, 1, 2)")).toEqual({
      expression: "If(true, 1, 2)",
      offset: 0
    });
  });

  it("leaves blank text unchanged", () => {
    expect(normalizeCanvasFormula("   ")).toEqual({
      expression: "   ",
      offset: 0
    });
  });
});


describe("mergeOfficialPowerFxFindings", () => {
  const lexical: Finding = {
    id: "lexical",
    ruleId: "powerfx.syntax.lexical-structure",
    severity: "error",
    category: "syntax",
    title: "Provisional syntax",
    message: "Unbalanced formula",
    confidence: "high"
  };
  const performance: Finding = {
    ...lexical,
    id: "performance",
    ruleId: "powerfx.performance.repeated-lookup",
    severity: "warning",
    category: "performance"
  };
  const official: Finding = {
    ...lexical,
    id: "official",
    ruleId: "powerfx.official.syntax",
    title: "Official syntax"
  };

  it("removes only the provisional lexical finding when the official parser is ready", () => {
    expect(mergeOfficialPowerFxFindings(
      [lexical, performance],
      [official],
      true
    )).toEqual([official, performance]);
  });

  it("preserves the lexical fallback when the official parser is loading or unavailable", () => {
    expect(mergeOfficialPowerFxFindings(
      [performance, lexical],
      [],
      false
    )).toEqual([lexical, performance]);
  });

  it("does not mutate static findings and retains other syntax rules", () => {
    const structural: Finding = {
      ...lexical,
      id: "source",
      ruleId: "source.pa-yaml-v3-schema"
    };
    const original = [performance, structural, lexical];
    expect(mergeOfficialPowerFxFindings(original, [], true)).toEqual([
      structural,
      performance
    ]);
    expect(original).toEqual([performance, structural, lexical]);
  });
});

describe("findingsFromOfficialBatch", () => {
  const refs: FormulaRef[] = [
    {
      formula: "=If(",
      property: "Text",
      ownerName: "Label1",
      ownerType: "control",
      controlPath: "Screens/Main/Label1",
      sourceFile: "Main.pa.yaml"
    },
    {
      formula: "=1 + 2",
      property: "Width",
      ownerName: "Label2",
      ownerType: "control",
      controlPath: "Screens/Main/Label2",
      sourceFile: "Main.pa.yaml"
    }
  ];

  it("maps out-of-order results and preserves warnings on successful parses", () => {
    const findings = findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "1", result: { success: true, errors: [
          { message: "Review syntax", warning: true, start: 0, end: 1 }
        ] } },
        { id: "0", result: { success: false, errors: [
          { message: "Unexpected token", warning: false, start: 0, end: 2 }
        ] } }
      ]
    });

    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      severity: "warning",
      controlPath: "Screens/Main/Label2"
    });
    expect(findings[1]).toMatchObject({
      severity: "error",
      controlPath: "Screens/Main/Label1"
    });
    expect(findings[1].message).toContain("Character span 1–3");
  });

  it("rejects a missing result instead of marking incomplete analysis ready", () => {
    expect(() => findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [{ id: "0", result: { success: true, errors: [] } }]
    })).toThrow(/incomplete or invalid batch/u);
  });

  it("rejects duplicate result identifiers even when the result count matches", () => {
    expect(() => findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "0", result: { success: true, errors: [] } },
        { id: "0", result: { success: true, errors: [] } }
      ]
    })).toThrow(/incomplete or invalid batch/u);
  });

  it("rejects unknown result identifiers instead of silently dropping them", () => {
    expect(() => findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "0", result: { success: true, errors: [] } },
        { id: "999", result: { success: true, errors: [] } }
      ]
    })).toThrow(/incomplete or invalid batch/u);
  });

  it("rejects failed parses without diagnostics to retain the TS fallback", () => {
    expect(() => findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "0", result: { success: false, errors: [] } },
        { id: "1", result: { success: true, errors: [] } }
      ]
    })).toThrow(/incomplete or invalid batch/u);
  });
  it.each([
    { engine: "AnotherEngine", mode: "parseBatch" },
    { engine: "Microsoft.PowerFx", mode: "check" },
    { engine: undefined, mode: "parseBatch" }
  ])("rejects a batch without official parse provenance: %o", ({ engine, mode }) => {
    expect(() => findingsFromOfficialBatch(refs, {
      engine,
      mode,
      success: true,
      results: [
        { id: "0", result: { success: true, errors: [] } },
        { id: "1", result: { success: true, errors: [] } }
      ]
    })).toThrow(/incomplete or invalid batch/u);
  });

  it.each([
    { label: "negative", start: -1, end: 1 },
    { label: "reversed", start: 2, end: 1 },
    { label: "out of bounds", start: 0, end: 100 },
    { label: "fractional", start: 0.5, end: 1 },
    { label: "missing end", start: 0, end: undefined }
  ])("rejects $label parser spans to preserve fallback diagnostics", ({ start, end }) => {
    expect(() => findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "0", result: { success: false, errors: [
          { message: "Unexpected token", start, end }
        ] } },
        { id: "1", result: { success: true, errors: [] } }
      ]
    })).toThrow(/incomplete or invalid batch/u);
  });

  it.each([
    { label: "string warning flag", diagnostic: { message: "Bad flag", warning: "false" } },
    { label: "numeric warning flag", diagnostic: { message: "Bad flag", warning: 0 } },
    { label: "object severity", diagnostic: { message: "Bad severity", warning: false, severity: { value: "Error" } } }
  ])("rejects $label rather than misclassifying an official diagnostic", ({ diagnostic }) => {
    // Simulate malformed JSON crossing the JS/.NET boundary, bypassing TS types.
    const response = {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "0", result: { success: false, errors: [diagnostic] } },
        { id: "1", result: { success: true, errors: [] } }
      ]
    };
    expect(() => findingsFromOfficialBatch(
      refs,
      response as unknown as Parameters<typeof findingsFromOfficialBatch>[1]
    )).toThrow(/incomplete or invalid batch/u);
  });

  it("accepts an end-of-expression span and diagnostics without positions", () => {
    const findings = findingsFromOfficialBatch(refs, {
      engine: "Microsoft.PowerFx",
      mode: "parseBatch",
      success: true,
      results: [
        { id: "0", result: { success: false, errors: [
          { message: "Unexpected token", start: null, end: null }
        ] } },
        { id: "1", result: { success: true, errors: [
          { message: "At end", warning: true, start: 5, end: 5 }
        ] } }
      ]
    });
    expect(findings).toHaveLength(2);
    expect(findings[0].message).not.toContain("Character span");
    expect(findings[1].message).toContain("Character span 6–6");
  });

});
