import { latencyFor, sleep, type Adapter } from "../types";

/** Mock freight forwarder booking API (IFTMIN out, IFTSTA back). */
export const forwarder: Adapter = {
  system: "Forwarder",
  async execute(action, ctx) {
    const latency_ms = latencyFor(action, 800, 600);
    await sleep(latency_ms);
    const seq = ctx.nextSeq();
    return { doc_number: `FWD-${String(770100 + seq * 7)}`, latency_ms, status: "written", message: "booking acknowledged" };
  },
};
