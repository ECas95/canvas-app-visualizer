import Ajv, { type ErrorObject } from "ajv";
import { parse } from "yaml";
import schemaText from "../../schema/pa.schema.yaml?raw";
import type { ParseProblem, SourceFile } from "../../types/canvas";

type JsonObject = Record<string, unknown>;

const bundledSchema = parse(schemaText) as JsonObject;
const skippedUpstreamPatterns: Array<{ path: string; pattern: string }> = [];

function schemaForAjv(
  value: unknown,
  path = "$"
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      schemaForAjv(item, path + "[" + index + "]")
    );
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const source = value as JsonObject;
  const output: JsonObject = {};

  for (const [key, child] of Object.entries(source)) {
    if (key === "pattern" && typeof child === "string") {
      try {
        // Ajv compiles schema patterns to ECMAScript RegExp. Keep the
        // vendored upstream schema byte-for-byte and skip only patterns
        // that are not valid ECMAScript regular expressions.
        new RegExp(child, "u");
        output[key] = child;
      } catch {
        skippedUpstreamPatterns.push({
          path: path + ".pattern",
          pattern: child
        });
      }
      continue;
    }

    output[key] = schemaForAjv(child, path + "." + key);
  }

  return output;
}

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true
});
const validate = ajv.compile(schemaForAjv(bundledSchema));

const MODERN_TOP_LEVEL = new Set([
  "App",
  "Screens",
  "ComponentDefinitions",
  "DataSources",
  "EditorState"
]);

function errorMessage(error: ErrorObject): string {
  const path = error.instancePath || "/";
  const detail = error.message ?? error.keyword;
  const params =
    error.keyword === "additionalProperties" &&
    typeof error.params.additionalProperty === "string"
      ? " (" + error.params.additionalProperty + ")"
      : "";

  return path + ": " + detail + params;
}

export function validatePaYamlObject(
  value: unknown,
  file: SourceFile
): ParseProblem[] {
  if (file.format !== "pa-yaml-v3") return [];

  const valid = validate(value);
  const problems: ParseProblem[] = [];

  if (!valid) {
    for (const error of validate.errors ?? []) {
      problems.push({
        file: file.path,
        path: error.instancePath || "/",
        message: "Canvas v3 schema: " + errorMessage(error),
        severity: "error",
        source: "schema"
      });
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value as Record<string, unknown>);
    const recognized = keys.filter(key => MODERN_TOP_LEVEL.has(key));

    if (recognized.length > 1) {
      problems.push({
        file: file.path,
        path: "/",
        message:
          "Current source-control guidance places one top-level Canvas object per .pa.yaml file. This file contains: " +
          recognized.join(", ") +
          ".",
        severity: "warning",
        source: "format"
      });
    }
  }

  return problems;
}

export function getBundledSchemaInfo(): {
  id?: string;
  title?: string;
  skippedInvalidPatterns: ReadonlyArray<{
    path: string;
    pattern: string;
  }>;
} {
  const typed = bundledSchema as { $id?: string; title?: string };
  return {
    id: typed.$id,
    title: typed.title,
    skippedInvalidPatterns
  };
}
