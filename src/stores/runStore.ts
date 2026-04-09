import { create } from "zustand";

// ─── Types ───────────────────────────────────────────────────────────────

export type RunBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string; collapsed: boolean }
  | { type: "tool_use"; toolName: string; inputJson: string; inputObj?: unknown };

export interface RunMessage {
  id: string;
  role: "assistant" | "user";
  blocks: RunBlock[];
  done: boolean;
}

export type RunStatus = "starting" | "running" | "complete" | "failed" | "aborted";

export interface RunState {
  runId: string;
  planPath: string;
  status: RunStatus;
  messages: RunMessage[];
  totalCostUsd: number;
  durationMs?: number;
  numTurns?: number;
  retrospectivePath?: string;
  rateLimitWarning?: string;
  errorMessage?: string;
  eventCount: number;
}

interface RunStore {
  runs: Record<string, RunState>;
  initRun: (runId: string, planPath: string) => void;
  applyEvent: (runId: string, event: unknown) => void;
  markCompleted: (
    runId: string,
    payload: {
      total_cost_usd: number;
      duration_ms: number;
      num_turns: number;
      is_error?: boolean;
      retrospective_path?: string | null;
    }
  ) => void;
  markAborted: (runId: string, partialEventCount: number) => void;
  markError: (runId: string, message: string) => void;
}

// ─── Reducer helpers ─────────────────────────────────────────────────────

function newMessage(id: string, role: "assistant" | "user"): RunMessage {
  return { id, role, blocks: [], done: false };
}

function applyEventReducer(run: RunState, raw: unknown): RunState {
  if (!raw || typeof raw !== "object") return run;
  const ev = raw as Record<string, unknown>;
  const type = ev.type as string | undefined;

  const next: RunState = { ...run, eventCount: run.eventCount + 1 };
  next.messages = [...run.messages];

  if (type === "system") {
    const subtype = ev.subtype as string | undefined;
    if (subtype === "init") {
      next.status = "running";
    }
    return next;
  }

  if (type === "rate_limit_event") {
    const remaining =
      (ev.tokens_remaining as number | undefined) ??
      (ev.requests_remaining as number | undefined);
    if (typeof remaining === "number") {
      next.rateLimitWarning = `Rate limit headroom: ${remaining}`;
    }
    return next;
  }

  if (type === "stream_event") {
    const inner = ev.event as Record<string, unknown> | undefined;
    if (!inner) return next;
    const innerType = inner.type as string | undefined;

    if (innerType === "message_start") {
      const message = inner.message as Record<string, unknown> | undefined;
      const id = (message?.id as string | undefined) ?? `msg-${next.messages.length}`;
      next.messages.push(newMessage(id, "assistant"));
      return next;
    }

    if (innerType === "content_block_start") {
      const block = inner.content_block as Record<string, unknown> | undefined;
      const blockType = block?.type as string | undefined;
      const last = next.messages[next.messages.length - 1];
      if (!last) return next;
      const lastBlocks = [...last.blocks];
      if (blockType === "text") {
        lastBlocks.push({ type: "text", text: "" });
      } else if (blockType === "thinking") {
        lastBlocks.push({ type: "thinking", text: "", collapsed: true });
      } else if (blockType === "tool_use") {
        const toolName = (block?.name as string | undefined) ?? "unknown";
        lastBlocks.push({ type: "tool_use", toolName, inputJson: "" });
      }
      next.messages[next.messages.length - 1] = { ...last, blocks: lastBlocks };
      return next;
    }

    if (innerType === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      const deltaType = delta?.type as string | undefined;
      const last = next.messages[next.messages.length - 1];
      if (!last || last.blocks.length === 0) return next;
      const lastBlocks = [...last.blocks];
      const idx = lastBlocks.length - 1;
      const block = lastBlocks[idx];

      if (deltaType === "text_delta" && block.type === "text") {
        const txt = (delta?.text as string | undefined) ?? "";
        lastBlocks[idx] = { ...block, text: block.text + txt };
      } else if (deltaType === "thinking_delta" && block.type === "thinking") {
        const txt = (delta?.thinking as string | undefined) ?? "";
        lastBlocks[idx] = { ...block, text: block.text + txt };
      } else if (deltaType === "input_json_delta" && block.type === "tool_use") {
        const partial = (delta?.partial_json as string | undefined) ?? "";
        const accum = block.inputJson + partial;
        let parsedInput: unknown | undefined;
        try {
          parsedInput = JSON.parse(accum);
        } catch {
          // intentionally swallow — partial JSON not yet parseable
        }
        lastBlocks[idx] = { ...block, inputJson: accum, inputObj: parsedInput };
      }

      next.messages[next.messages.length - 1] = { ...last, blocks: lastBlocks };
      return next;
    }

    if (innerType === "message_stop") {
      const last = next.messages[next.messages.length - 1];
      if (last) {
        next.messages[next.messages.length - 1] = { ...last, done: true };
      }
      return next;
    }
  }

  // Full assistant snapshot — used as canonical fallback if deltas were lost.
  if (type === "assistant") {
    const message = ev.message as Record<string, unknown> | undefined;
    const id = (message?.id as string | undefined) ?? `snap-${next.messages.length}`;
    const content = message?.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content)) {
      // If we already started this message via deltas, just mark it done.
      const existing = next.messages.find((m) => m.id === id);
      if (existing) {
        existing.done = true;
      } else {
        const blocks: RunBlock[] = content.map((block) => {
          const t = block.type as string | undefined;
          if (t === "text") {
            return { type: "text", text: (block.text as string) ?? "" };
          }
          if (t === "thinking") {
            return { type: "thinking", text: (block.thinking as string) ?? "", collapsed: true };
          }
          if (t === "tool_use") {
            return {
              type: "tool_use",
              toolName: (block.name as string) ?? "unknown",
              inputJson: JSON.stringify(block.input ?? {}),
              inputObj: block.input,
            };
          }
          return { type: "text", text: "" };
        });
        next.messages.push({ id, role: "assistant", blocks, done: true });
      }
    }
    return next;
  }

  return next;
}

// ─── Store ───────────────────────────────────────────────────────────────

export const useRunStore = create<RunStore>((set) => ({
  runs: {},

  initRun: (runId, planPath) =>
    set((s) => ({
      runs: {
        ...s.runs,
        [runId]: {
          runId,
          planPath,
          status: "starting",
          messages: [],
          totalCostUsd: 0,
          eventCount: 0,
        },
      },
    })),

  applyEvent: (runId, event) =>
    set((s) => {
      const run = s.runs[runId];
      if (!run) return s;
      return { runs: { ...s.runs, [runId]: applyEventReducer(run, event) } };
    }),

  markCompleted: (runId, payload) =>
    set((s) => {
      const run = s.runs[runId];
      if (!run) return s;
      return {
        runs: {
          ...s.runs,
          [runId]: {
            ...run,
            status: payload.is_error ? "failed" : "complete",
            totalCostUsd: payload.total_cost_usd,
            durationMs: payload.duration_ms,
            numTurns: payload.num_turns,
            retrospectivePath: payload.retrospective_path ?? undefined,
          },
        },
      };
    }),

  markAborted: (runId, _partial) =>
    set((s) => {
      const run = s.runs[runId];
      if (!run) return s;
      return { runs: { ...s.runs, [runId]: { ...run, status: "aborted" } } };
    }),

  markError: (runId, message) =>
    set((s) => {
      const run = s.runs[runId];
      if (!run) return s;
      return {
        runs: { ...s.runs, [runId]: { ...run, status: "failed", errorMessage: message } },
      };
    }),
}));
