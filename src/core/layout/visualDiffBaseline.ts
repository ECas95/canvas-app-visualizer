import type { PixelDiffReport, PixelRegionMetric } from "./visualDiff";

const MAX_BASELINE_BYTES = 512 * 1024;

export interface VisualBaseline {
  schemaVersion: 1;
  context: { screen: string; reference: string; generatedAt: string };
  metrics: {
    width: number; height: number; threshold: number;
    meanAbsoluteError: number; rootMeanSquareError: number;
    changedPercent: number;
  };
  regions: Array<Pick<PixelRegionMetric,
    "id" | "label" | "meanAbsoluteError" | "changedPercent" | "pixels">>;
}

export interface BaselineDelta {
  id: string;
  label: string;
  oldError: number;
  newError: number;
  deltaError: number;
}

export interface BaselineComparison {
  compatible: boolean;
  reason?: string;
  meanErrorDelta: number;
  rmseDelta: number;
  changedPercentDelta: number;
  improvements: BaselineDelta[];
  regressions: BaselineDelta[];
}

function finite(x: unknown, min: number, max: number): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
}
function metric(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}
function shortString(x: unknown, max = 256): x is string {
  return typeof x === "string" && x.length <= max;
}

/** Load only metrics/control labels from a previous explicit local JSON export. */
export function parseVisualBaseline(json: string): VisualBaseline {
  if (new TextEncoder().encode(json).length > MAX_BASELINE_BYTES) {
    throw new Error("Baseline JSON exceeds the 512 KB local limit.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new Error("Invalid baseline JSON."); }
  if (!metric(parsed) || parsed.schemaVersion !== 1 ||
      !metric(parsed.context) || !metric(parsed.metrics) ||
      !Array.isArray(parsed.regions) || parsed.regions.length > 400 ||
      !shortString(parsed.context.screen) ||
      !shortString(parsed.context.reference) ||
      !shortString(parsed.context.generatedAt, 100)) {
    throw new Error("Not a supported Canvas visual-diff report.");
  }
  const m = parsed.metrics;
  if (!finite(m.width, 1, 8192) || !Number.isInteger(m.width) ||
      !finite(m.height, 1, 8192) || !Number.isInteger(m.height) ||
      !finite(m.threshold, 0, 255) ||
      !finite(m.meanAbsoluteError, 0, 255) ||
      !finite(m.rootMeanSquareError, 0, 255) ||
      !finite(m.changedPercent, 0, 100)) {
    throw new Error("Malformed baseline screenshot metrics.");
  }
  const regions = parsed.regions.map((region: unknown) => {
    if (!metric(region) || !shortString(region.id) ||
        !shortString(region.label) ||
        !finite(region.meanAbsoluteError, 0, 255) ||
        !finite(region.changedPercent, 0, 100) ||
        !finite(region.pixels, 0, 4_000_000)) {
      throw new Error("Malformed baseline region.");
    }
    return {
      id: region.id, label: region.label,
      meanAbsoluteError: region.meanAbsoluteError,
      changedPercent: region.changedPercent, pixels: region.pixels
    };
  });
  return {
    schemaVersion: 1,
    context: {
      screen: parsed.context.screen,
      reference: parsed.context.reference,
      generatedAt: parsed.context.generatedAt
    },
    metrics: {
      width: m.width, height: m.height, threshold: m.threshold,
      meanAbsoluteError: m.meanAbsoluteError,
      rootMeanSquareError: m.rootMeanSquareError,
      changedPercent: m.changedPercent
    },
    regions
  };
}

export function compareVisualBaseline(
  baseline: VisualBaseline,
  current: PixelDiffReport,
  screenName: string
): BaselineComparison {
  const old = baseline.metrics;
  const compatible = old.width === current.width &&
    old.height === current.height &&
    old.threshold === current.threshold &&
    baseline.context.screen.toLowerCase() === screenName.toLowerCase();
  if (!compatible) {
    return {
      compatible: false, reason:
        "Screen, viewport or threshold differs from baseline; compare equivalent captures.",
      meanErrorDelta: 0, rmseDelta: 0, changedPercentDelta: 0,
      improvements: [], regressions: []
    };
  }
  const before = new Map(baseline.regions.map(region => [region.id, region]));
  const deltas: BaselineDelta[] = current.regions.flatMap(region => {
    const matched = before.get(region.id);
    if (!matched) return [];
    const deltaError = region.meanAbsoluteError - matched.meanAbsoluteError;
    return [{
      id: region.id, label: region.label,
      oldError: matched.meanAbsoluteError,
      newError: region.meanAbsoluteError,
      deltaError
    }];
  });
  return {
    compatible: true,
    meanErrorDelta: current.meanAbsoluteError - old.meanAbsoluteError,
    rmseDelta: current.rootMeanSquareError - old.rootMeanSquareError,
    changedPercentDelta: current.changedPercent - old.changedPercent,
    improvements: deltas.filter(r => r.deltaError < -0.01)
      .sort((a, b) => a.deltaError - b.deltaError).slice(0, 12),
    regressions: deltas.filter(r => r.deltaError > 0.01)
      .sort((a, b) => b.deltaError - a.deltaError).slice(0, 12)
  };
}
