"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ADAPTERS, executeActions } from "./agents/execute";
import { DEFAULT_CLOCK, PERSONAS, type PersonaId } from "./personas";
import type { AgentActionSpec, DisruptionType, ExecutionAction, Signal } from "./schema";
import type { FeedSignal } from "./view";
import { DEFAULT_WEIGHTS, type Weights } from "./scoring";

export const STORE_KEY = "ste-supplier-resilience";
export const STORE_VERSION = 1;

export interface Decision {
  id: string;
  context: string; // signal id or screen
  kind: "approve" | "reject" | "defer" | "override" | "sourcing_task" | "dismiss_rec" | "split_po" | "inject";
  option_id?: string;
  option_name?: string;
  reason?: string;
  follow_up?: string;
  persona: PersonaId;
  at: string;
}

export interface Feedback {
  id: string;
  screen: string;
  wrong: string;
  missing: string;
  owner: string;
  persona: PersonaId;
  at: string;
}

export interface Override {
  type?: DisruptionType;
  material?: boolean;
  by: PersonaId;
  at: string;
}

export interface SourcingTask {
  id: string;
  rec_id: string;
  part_id: string;
  candidate_supplier_ids: string[];
  by: PersonaId;
  at: string;
}

export interface DraftRecord {
  signal: Signal;
  feed: FeedSignal;
}

export interface Injected {
  id: string; // library id or draft id
  at: string; // simulated clock time of injection
}

interface State {
  persona: PersonaId;
  clock: string;
  log: ExecutionAction[];
  decisions: Decision[];
  feedback: Feedback[];
  overrides: Record<string, Override>;
  sourcingTasks: SourcingTask[];
  dismissedRecs: Record<string, string>;
  injected: Injected[];
  drafts: DraftRecord[];
  weights: Weights;
  docSeq: number;
  // ui (not persisted)
  flagOpen: boolean;
  devOpen: boolean;
  hydrated: boolean;
}

interface Actions {
  setPersona(p: PersonaId): void;
  setClock(iso: string): void;
  advanceClock(hours: number): void;
  setFlagOpen(v: boolean): void;
  setDevOpen(v: boolean): void;
  addFeedback(f: Omit<Feedback, "id" | "at" | "persona">): void;
  removeFeedback(id: string): void;
  approve(context: string, option: { id: string; name: string; actions: AgentActionSpec[] }, note?: string): string;
  reject(context: string, reason: string): void;
  defer(context: string, followUp: string, reason: string): void;
  override(signalId: string, o: Pick<Override, "type" | "material">): void;
  createSourcingTask(t: Omit<SourcingTask, "id" | "at" | "by">): void;
  dismissRec(recId: string, reason: string): void;
  inject(id: string): void;
  addDraft(d: DraftRecord): void;
  setWeights(w: Weights): void;
  resetDemo(): void;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const initial = (): Omit<State, "hydrated" | "flagOpen" | "devOpen"> => ({
  persona: "buyer",
  clock: DEFAULT_CLOCK,
  log: [],
  decisions: [],
  feedback: [],
  overrides: {},
  sourcingTasks: [],
  dismissedRecs: {},
  injected: [],
  drafts: [],
  weights: DEFAULT_WEIGHTS,
  docSeq: 0,
});

/** Simulated wall clock: the demo clock plus the real seconds elapsed since it was set. */
const stamp = (clock: string) => clock;

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => {
      const humanLog = (context: string, action: string, label: string, payload: Record<string, unknown> = {}) => {
        const s = get();
        const entry: ExecutionAction = {
          id: uid("ACT"),
          decision_id: uid("DEC"),
          actor: "human",
          actor_name: PERSONAS[s.persona].name,
          system: "Prototype",
          action,
          label,
          doc_number: null,
          status: "confirmed",
          payload,
          context,
          created_at: stamp(s.clock),
          updated_at: stamp(s.clock),
        };
        set({ log: [entry, ...s.log] });
      };

      return {
        ...initial(),
        flagOpen: false,
        devOpen: false,
        hydrated: false,

        setPersona: (persona) => set({ persona }),
        setClock: (clock) => set({ clock }),
        advanceClock: (hours) => set({ clock: new Date(Date.parse(get().clock) + hours * 3_600_000).toISOString() }),
        setFlagOpen: (flagOpen) => set({ flagOpen }),
        setDevOpen: (devOpen) => set({ devOpen }),

        addFeedback: (f) =>
          set({ feedback: [{ ...f, id: uid("FB"), at: get().clock, persona: get().persona }, ...get().feedback] }),
        removeFeedback: (id) => set({ feedback: get().feedback.filter((f) => f.id !== id) }),

        approve: (context, option, note) => {
          const s = get();
          const decisionId = uid("DEC");
          set({
            decisions: [
              { id: decisionId, context, kind: "approve", option_id: option.id, option_name: option.name, reason: note, persona: s.persona, at: s.clock },
              ...s.decisions,
            ],
          });
          humanLog(context, "approve_option", `Approved ${option.id}: ${option.name}`, { option_id: option.id, actions: option.actions.length });
          const approver = PERSONAS[s.persona].name;
          void executeActions(option.actions, {
            nextSeq: () => {
              const n = get().docSeq + 1;
              set({ docSeq: n });
              return n;
            },
            onQueued: (_i, a) => {
              const t = get().clock;
              const entry: ExecutionAction = {
                id: uid("ACT"),
                decision_id: decisionId,
                actor: "agent",
                actor_name: `Agent for ${approver}`,
                system: a.system,
                action: a.action,
                label: a.label,
                doc_number: null,
                status: "queued",
                payload: a.payload,
                context,
                created_at: t,
                updated_at: t,
              };
              set({ log: [entry, ...get().log] });
              return entry.id;
            },
            onStatus: (id, status, patch) => {
              const now = new Date(Date.parse(get().clock) + 1000).toISOString();
              set({
                clock: now,
                log: get().log.map((l) =>
                  l.id === id
                    ? { ...l, status, doc_number: patch?.doc_number ?? l.doc_number, updated_at: now, payload: patch?.message ? { ...l.payload, _system_message: patch.message } : l.payload }
                    : l,
                ),
              });
            },
          });
          return decisionId;
        },

        reject: (context, reason) => {
          const s = get();
          set({ decisions: [{ id: uid("DEC"), context, kind: "reject", reason, persona: s.persona, at: s.clock }, ...s.decisions] });
          humanLog(context, "reject_all_options", "Rejected all options", { reason });
        },
        defer: (context, followUp, reason) => {
          const s = get();
          set({ decisions: [{ id: uid("DEC"), context, kind: "defer", follow_up: followUp, reason, persona: s.persona, at: s.clock }, ...s.decisions] });
          humanLog(context, "defer_decision", `Deferred to ${followUp}`, { follow_up: followUp, reason });
        },
        override: (signalId, o) => {
          const s = get();
          set({ overrides: { ...s.overrides, [signalId]: { ...s.overrides[signalId], ...o, by: s.persona, at: s.clock } } });
          set({ decisions: [{ id: uid("DEC"), context: signalId, kind: "override", reason: JSON.stringify(o), persona: s.persona, at: s.clock }, ...get().decisions] });
          humanLog(signalId, "override_classification", `Override ${Object.entries(o).map(([k, v]) => `${k}=${v}`).join(", ")}`, o as Record<string, unknown>);
        },
        createSourcingTask: (t) => {
          const s = get();
          const task = { ...t, id: `ST-${String(s.sourcingTasks.length + 101)}`, at: s.clock, by: s.persona };
          set({ sourcingTasks: [task, ...s.sourcingTasks] });
          set({ decisions: [{ id: uid("DEC"), context: t.rec_id, kind: "sourcing_task", persona: s.persona, at: s.clock }, ...get().decisions] });
          humanLog("/scorecard", "approve_diversification", `Approved ${t.rec_id}; sourcing task ${task.id} created`, { ...t, task_id: task.id });
        },
        dismissRec: (recId, reason) => {
          const s = get();
          set({ dismissedRecs: { ...s.dismissedRecs, [recId]: reason } });
          set({ decisions: [{ id: uid("DEC"), context: recId, kind: "dismiss_rec", reason, persona: s.persona, at: s.clock }, ...get().decisions] });
          humanLog("/scorecard", "dismiss_diversification", `Dismissed ${recId}`, { reason });
        },
        inject: (id) => {
          const s = get();
          if (s.injected.some((x) => x.id === id)) return;
          set({ injected: [{ id, at: s.clock }, ...s.injected] });
          humanLog(id, "inject_signal", `Injected signal ${id}`, {});
        },
        addDraft: (d) => {
          set({ drafts: [d, ...get().drafts] });
          get().inject(d.signal.id);
        },
        setWeights: (weights) => set({ weights }),
        resetDemo: () => set({ ...initial() }),
      };
    },
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        const { flagOpen, devOpen, hydrated, ...rest } = s;
        void flagOpen;
        void devOpen;
        void hydrated;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function"));
      },
      onRehydrateStorage: () => (state) => {
        // Executions interrupted by a reload: written ones were accepted; queued or writing ones resume.
        const log = (state?.log ?? []).map((l) => (l.status === "written" ? { ...l, status: "confirmed" as const } : l));
        useStore.setState({ hydrated: true, log });
        void resumeInterrupted();
      },
    },
  ),
);

/** Re-run agent actions that were queued or mid-write when the page reloaded. */
async function resumeInterrupted() {
  const pending = useStore
    .getState()
    .log.filter((l) => l.actor === "agent" && (l.status === "queued" || l.status === "writing") && l.system !== "Prototype")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const patch = (id: string, p: Partial<ExecutionAction>) =>
    useStore.setState({ log: useStore.getState().log.map((l) => (l.id === id ? { ...l, ...p, updated_at: useStore.getState().clock } : l)) });
  for (const l of pending) {
    patch(l.id, { status: "writing" });
    const adapter = ADAPTERS[l.system as keyof typeof ADAPTERS];
    const res = await adapter.execute({ system: adapter.system, action: l.action, label: l.label, payload: l.payload }, {
      nextSeq: () => {
        const n = useStore.getState().docSeq + 1;
        useStore.setState({ docSeq: n });
        return n;
      },
    });
    patch(l.id, { status: res.status === "written" ? "written" : "failed", doc_number: res.doc_number });
    setTimeout(() => patch(l.id, { status: "confirmed" }), 400);
  }
}
