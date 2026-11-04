import type { CanvasScreen } from "../../types/canvas";
import { lexPowerFx, significantTokens, type PowerFxToken } from "./lexer";
import { evaluateStaticPowerFx, type StaticPowerFxValue } from "./staticEval";
import {
  previewScopedSymbols, simulateScopedPreviewBehavior,
  type PreviewScopedState, type PreviewVariables
} from "./previewBehavior";

export interface PreviewNavigationState {
  screenId: string;
  history: string[];
  globals: PreviewVariables;
  contexts: Record<string, PreviewVariables>;
  notices: string[];
  events: string[];
}

export interface PreviewNavigationResult {
  ok: boolean;
  state: PreviewNavigationState;
  message: string;
  partial: boolean;
}

const MAX_FORMULA = 12000;
const MAX_DEPTH = 10;
const MAX_ACTIONS = 48;
const MAX_TRANSITIONS = 8;
const MAX_NOTICES = 30;

function copy(state: PreviewNavigationState): PreviewNavigationState {
  return {
    ...state,
    history: [...state.history],
    globals: { ...state.globals },
    contexts: Object.fromEntries(Object.entries(state.contexts).map(([id, context]) =>
      [id, { ...context }])),
    notices: [...state.notices],
    events: [...state.events]
  };
}

export function createPreviewNavigationState(screenId: string): PreviewNavigationState {
  return { screenId, history: [], globals: {}, contexts: {}, notices: [], events: [] };
}

export function previewNavigationSymbols(state: PreviewNavigationState): PreviewVariables {
  return previewScopedSymbols({
    globals: state.globals,
    context: state.contexts[state.screenId] ?? {}
  });
}

function slice(source: string, tokens: PowerFxToken[]): string {
  return tokens.length
    ? source.slice(tokens[0].start, tokens[tokens.length - 1].end)
    : "";
}

function splitTopLevel(tokens: PowerFxToken[], separator: string): PowerFxToken[][] | null {
  if (!tokens.length) return null;
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const stack: string[] = [];
  const output: PowerFxToken[][] = [];
  let from = 0;
  for (let index = 0; index < tokens.length; index++) {
    const value = tokens[index].value;
    if (pairs[value]) stack.push(pairs[value]);
    else if (value === ")" || value === "}" || value === "]") {
      if (stack.pop() !== value) return null;
    } else if (value === separator && stack.length === 0) {
      if (from === index) return null;
      output.push(tokens.slice(from, index));
      from = index + 1;
    }
  }
  if (stack.length || from === tokens.length) return null;
  output.push(tokens.slice(from));
  return output;
}

function screenFor(screens: readonly CanvasScreen[], name: string): CanvasScreen | undefined {
  return screens.find(screen => screen.name.toLowerCase() === name.toLowerCase());
}

function identifier(token: PowerFxToken): string {
  return token.kind === "quotedIdentifier"
    ? token.value.slice(1, -1).replaceAll("''", "'")
    : token.value;
}

export function runPreviewNavigation(
  screens: readonly CanvasScreen[],
  input: PreviewNavigationState,
  formula: unknown,
  trigger: "OnSelect" | "OnVisible" | "OnHidden" | "OnStart" = "OnSelect",
  allowPartial = trigger !== "OnSelect"
): PreviewNavigationResult {
  const state = copy(input);
  let actions = 0;
  let transitions = 0;
  const messages: string[] = [];

  function notice(message: string): void {
    messages.push(message);
    state.notices.push(message);
    state.notices = state.notices.slice(-MAX_NOTICES);
  }

  function scoped(): PreviewScopedState {
    return { globals: state.globals, context: state.contexts[state.screenId] ?? {} };
  }

  function run(source: unknown, event: string, depth: number, partial: boolean): string | null {
    if (typeof source !== "string" || !source.trim()) return null;
    if (source.length > MAX_FORMULA || depth > MAX_DEPTH) {
      return "Formula length or nested behavior depth exceeds local preview limits.";
    }
    const lexical = lexPowerFx(source);
    if (lexical.diagnostics.length) return "Power Fx lexical error in " + event + ".";
    const tokens = significantTokens(lexical.tokens);
    if (tokens[0]?.value === "=") tokens.shift();
    const statements = splitTopLevel(tokens, ";");
    if (!statements) return "Malformed behavior sequence in " + event + ".";
    for (const statement of statements) {
      actions++;
      if (actions > MAX_ACTIONS) return "Preview action limit reached.";
      const problem = step(source, statement, depth, partial);
      if (problem) {
        if (!partial) return problem;
        notice("Skipped " + event + ": " + problem);
      }
    }
    return null;
  }

  function switchScreen(destination: CanvasScreen, back: boolean, depth: number): string | null {
    if (++transitions > MAX_TRANSITIONS) return "Navigation loop limit reached.";
    const from = screenFor(screens, state.screenId);
    if (!from) return "Current preview screen is not in the imported source.";
    if (from.id === destination.id) return null;
    const hidden = run(from.properties.OnHidden, from.name + ".OnHidden", depth + 1, true);
    if (hidden) notice("Skipped " + from.name + ".OnHidden: " + hidden);
    if (back) state.history.pop();
    else state.history.push(from.id);
    state.screenId = destination.id;
    state.events.push((back ? "Back → " : "Navigate → ") + destination.name);
    state.events = state.events.slice(-30);
    const visible = run(destination.properties.OnVisible,
      destination.name + ".OnVisible", depth + 1, true);
    if (visible) notice("Skipped " + destination.name + ".OnVisible: " + visible);
    return null;
  }

  function step(source: string, tokens: PowerFxToken[], depth: number, partial: boolean): string | null {
    if (tokens.length < 3 ||
        tokens[0].kind !== "identifier" || tokens[1].value !== "(" ||
        tokens[tokens.length - 1].value !== ")") {
      return "Only allowlisted local Power Fx behaviors can execute.";
    }
    const operation = tokens[0].value.toLowerCase();
    const argumentsList = tokens.length === 3 ? [] :
      splitTopLevel(tokens.slice(2, -1), ",");
    if (!argumentsList) return "Malformed argument list for " + tokens[0].value + ".";

    if (operation === "set" || operation === "updatecontext") {
      const result = simulateScopedPreviewBehavior("=" + slice(source, tokens), scoped());
      if (!result.ok) return result.message;
      state.globals = result.state.globals;
      state.contexts[state.screenId] = result.state.context;
      state.events.push(tokens[0].value + " (" + result.changes.join(", ") + ")");
      state.events = state.events.slice(-30);
      return null;
    }

    if (operation === "if") {
      if (argumentsList.length < 2) return "If requires a condition and behavior.";
      let matched = false;
      for (let index = 0; index + 1 < argumentsList.length; index += 2) {
        const condition = evaluateStaticPowerFx("=" + slice(source, argumentsList[index]),
          { symbols: previewNavigationSymbols(state) });
        if (typeof condition !== "boolean") return "If condition is not locally known.";
        if (!condition) continue;
        matched = true;
        const issue = run(slice(source, argumentsList[index + 1]), "If", depth + 1, partial);
        if (issue) return issue;
        break;
      }
      if (!matched && argumentsList.length % 2 === 1)
        return run(slice(source, argumentsList[argumentsList.length - 1]),
          "If default", depth + 1, partial);
      return null;
    }

    if (operation === "navigate") {
      if (argumentsList.length < 1 || argumentsList.length > 3) return "Navigate requires a target screen.";
      const target = argumentsList[0];
      if (target.length !== 1 ||
          !["identifier", "quotedIdentifier"].includes(target[0].kind)) {
        return "Navigate target must name an imported screen.";
      }
      const destination = screenFor(screens, identifier(target[0]));
      if (!destination) return "Unknown Navigate screen " + identifier(target[0]) + ".";
      if (argumentsList.length >= 2) {
        const transition = argumentsList[1];
        if (transition.length !== 3 ||
            transition[0].value.toLowerCase() !== "screentransition" ||
            transition[1].value !== "." ||
            !/^(?:none|fade|cover|uncover|coverright|uncoverright)$/i
              .test(transition[2].value)) {
          return "Unsupported screen transition; no navigation performed.";
        }
      }
      let updatedContext = { ...(state.contexts[destination.id] ?? {}) };
      if (argumentsList.length === 3) {
        const record = argumentsList[2];
        if (record[0]?.value !== "{" || record[record.length - 1]?.value !== "}")
          return "Navigate context must be a literal record.";
        const applied = simulateScopedPreviewBehavior(
          "=UpdateContext(" + slice(source, record) + ")", scoped());
        if (!applied.ok) return "Navigate context unresolved: " + applied.message;
        // Evaluate using the *source* screen context, but transfer only
        // explicitly named record fields. Carrying all source context into the
        // destination would invent cross-screen variables.
        const fields = splitTopLevel(record.slice(1, -1), ",");
        if (!fields) return "Navigate context record is malformed.";
        for (const field of fields) {
          if (field.length < 3 || field[1].value !== ":" ||
              field[0].kind !== "identifier") {
            return "Navigate context contains an unsupported field.";
          }
          const name = field[0].value;
          const resolved = Object.entries(applied.state.context)
            .find(([key]) => key.toLowerCase() === name.toLowerCase());
          if (!resolved) return "Navigate context field unresolved: " + name + ".";
          updatedContext[name] = resolved[1];
        }
      }
      // Target context is only committed once the destination and all
      // arguments have been validated.
      state.contexts[destination.id] = updatedContext;
      return switchScreen(destination, false, depth);
    }

    if (operation === "back") {
      if (argumentsList.length !== 0 && argumentsList.length !== 1)
        return "Back supports only a zero-argument or transition-only call.";
      if (argumentsList.length === 1) {
        const transition = argumentsList[0];
        if (transition.length !== 3 ||
            transition[0].value.toLowerCase() !== "screentransition" ||
            transition[1].value !== "." ||
            !/^(?:none|fade|cover|uncover|coverright|uncoverright)$/i
              .test(transition[2].value)) {
          return "Unsupported Back transition; no navigation performed.";
        }
      }
      const targetId = state.history[state.history.length - 1];
      const target = screens.find(screen => screen.id === targetId);
      return target ? switchScreen(target, true, depth) : "Back stack is empty.";
    }

    // Never interpret data connectors, Collect/ClearCollect, Patch, SubmitForm,
    // User(), external flows, Launch, or other side-effectful functions.
    return "Blocked or unsupported behavior " + tokens[0].value + ".";
  }

  if (!screenFor(screens, state.screenId)) {
    return { ok: false, state: input, partial: false, message: "Current screen not found." };
  }
  const issue = run(formula, trigger, 0, allowPartial);
  if (issue && !allowPartial) {
    return { ok: false, state: input, partial: false, message: issue };
  }
  if (issue) notice("Skipped " + trigger + ": " + issue);
  const partial = messages.length > 0;
  const message = partial
    ? "Partial local simulation — " + messages.slice(-2).join(" ")
    : issue ?? (state.events.at(-1) ?? "No locally executable actions.");
  return { ok: true, state, partial, message };
}

/** Opt-in lifecycle: Run App.OnStart and Screen.OnVisible, never automatically. */
export function startPreviewNavigation(
  screens: readonly CanvasScreen[],
  firstScreenId: string,
  appOnStart?: unknown
): PreviewNavigationResult {
  const state = createPreviewNavigationState(firstScreenId);
  if (!screens.some(screen => screen.id === firstScreenId)) {
    return { ok: false, state, partial: false, message: "Screen not found." };
  }
  const started = runPreviewNavigation(screens, state, appOnStart, "OnStart", true);
  // App.OnStart can itself Navigate, in which case OnVisible already ran
  // inside the destination transition; do not trigger it a second time.
  const wasRoutedDuringStart = started.state.screenId !== firstScreenId;
  const first = screens.find(screen => screen.id === started.state.screenId);
  const visible = wasRoutedDuringStart
    ? started
    : runPreviewNavigation(screens, started.state,
      first?.properties.OnVisible, "OnVisible", true);
  return {
    ok: visible.ok, state: visible.state,
    partial: started.partial || visible.partial,
    message: [started.message, visible.message].filter(Boolean).join(" · ")
  };
}

/** External screen selection behaves like entering another screen, without real app execution. */
export function selectPreviewNavigationScreen(
  screens: readonly CanvasScreen[],
  current: PreviewNavigationState,
  targetId: string
): PreviewNavigationResult {
  const destination = screens.find(s => s.id === targetId);
  if (!destination) return { ok: false, state: current, partial: false, message: "Unknown screen." };
  if (current.screenId === targetId) return { ok: true, state: current, partial: false, message: "Already selected." };
  const source = screens.find(s => s.id === current.screenId);
  let next = copy(current);
  if (source?.properties.OnHidden) {
    next = runPreviewNavigation(screens, next, source.properties.OnHidden, "OnHidden", true).state;
  }
  next.screenId = targetId;
  next.events.push("Explorer → " + destination.name);
  const visible = runPreviewNavigation(screens, next, destination.properties.OnVisible, "OnVisible", true);
  return { ...visible, message: "Explorer selected " + destination.name + ". " + visible.message };
}
