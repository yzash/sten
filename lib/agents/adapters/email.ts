import { latencyFor, sleep, type Adapter } from "../types";

/** Mock outbound email (Graph API in production). */
export const email: Adapter = {
  system: "Email",
  async execute(action, ctx) {
    const latency_ms = latencyFor(action, 400, 300);
    await sleep(latency_ms);
    const seq = ctx.nextSeq();
    return { doc_number: `MSG-${String(880000 + seq * 13)}`, latency_ms, status: "written", message: "queued for send" };
  },
};
