import { describe, expect, it } from "vitest";
import { staticString } from "../powerfx/staticEval";
import type { CanvasControl } from "../../types/canvas";
import { previewFormControl, previewFormFields, previewFormSymbols } from "./previewFormData";

function control(name: string, type: string,
  properties: Record<string, unknown>, children: CanvasControl[] = []): CanvasControl {
  return { id: name, name, controlType: type, properties, children, zIndex: 1,
    sourceFile: "Src/Synthetic.pa.yaml", sourcePath: name, sourceFormat: "pa-yaml-v3" };
}

describe("local-only Canvas Form/DataCard source previews", () => {
  const input = control("NameInput", "Classic/TextInput@2.3.2",
    { Default: "=Parent.Default" });
  const card = control("NameCard", "TypedDataCard@1.0",
    { DataField: '="Name"', Default: "=ThisItem.Name" }, [input]);
  const form = control("EditForm", "EditForm@2.4.0",
    { Item: "=LookUp(SQLTable, ID = 1)" }, [card]);

  it("discovers source fields without treating a Form.Item connector as a record", () => {
    expect(previewFormFields(form)).toContain("Name");
    expect(previewFormFields(form)).not.toContain("SQLTable");
  });

  it("uses explicit local scalar data to resolve DataCard.Parent.Default", () => {
    const symbols = previewFormSymbols({ Name: "Example Person" }, card);
    expect(symbols["ThisItem.Name"]).toBe("Example Person");
    expect(staticString(input.properties.Default, symbols)).toBe("Example Person");
    expect(previewFormControl(input, symbols, true, card)).toBe(input);
  });

  it("uses bracketed visual examples when the runtime Form.Item is unknown", () => {
    const symbols = previewFormSymbols(undefined, card);
    const painted = previewFormControl(input, symbols, true, card);
    expect(painted).not.toBe(input);
    expect(staticString(painted.properties.Default)).toBe("[Name #example]");
    expect(input.properties.Default).toBe("=Parent.Default");
    expect(previewFormControl(input, symbols, false, card)).toBe(input);
  });
});
