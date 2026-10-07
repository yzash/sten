import { latencyFor, sleep, type Adapter } from "../types";

/** Mock MES and planning: induction schedule changes and notifications. */
export const planning: Adapter = {
  system: "Planning",
  async execute(action, ctx) {
    const latency_ms = latencyFor(action, 450, 400);
    await sleep(latency_ms);
    const seq = ctx.nextSeq();
    return { doc_number: `PLN-${String(30200 + seq)}`, latency_ms, status: "written", message: "planning notified" };
  },
};
