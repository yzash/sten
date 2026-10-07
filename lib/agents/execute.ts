import type { AgentActionSpec, ExecStatus, System } from "@/lib/schema";
import { email } from "./adapters/email";
import { forwarder } from "./adapters/forwarder";
import { planning } from "./adapters/planning";
import { sapFi } from "./adapters/sap-fi";
import { sapMm } from "./adapters/sap-mm";
import { sleep, type Adapter, type AdapterContext } from "./types";

export const ADAPTERS: Record<System, Adapter> = {
  "SAP MM": sapMm,
  "SAP FI": sapFi,
  Forwarder: forwarder,
  Planning: planning,
  Email: email,
};

export interface ExecutionHooks extends AdapterContext {
  onQueued(index: number, action: AgentActionSpec): string; // returns log id
  onStatus(logId: string, status: ExecStatus, patch?: { doc_number?: string; message?: string }): void;
}

/**
 * Runs an approved option's actions through the adapters, in order.
 * Each action moves queued → writing → written → confirmed (or failed).
 * The LLM never calls this; only a human approval does.
 */
export async function executeActions(actions: AgentActionSpec[], hooks: ExecutionHooks): Promise<void> {
  const ids = actions.map((a, i) => hooks.onQueued(i, a));
  await sleep(350);
  for (let i = 0; i < actions.length; i++) {
    const id = ids[i];
    hooks.onStatus(id, "writing");
    try {
      const res = await ADAPTERS[actions[i].system].execute(actions[i], hooks);
      if (res.status === "failed") {
        hooks.onStatus(id, "failed", { message: res.message });
        continue;
      }
      hooks.onStatus(id, "written", { doc_number: res.doc_number, message: res.message });
      // confirmation arrives asynchronously from the system of record
      const confirmAfter = 420 + i * 60;
      setTimeout(() => hooks.onStatus(id, "confirmed"), confirmAfter);
    } catch (e) {
      hooks.onStatus(id, "failed", { message: e instanceof Error ? e.message : "adapter error" });
    }
  }
}
