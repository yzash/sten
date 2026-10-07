import { latencyFor, sleep, type Adapter } from "../types";

/** Mock SAP FI: payment blocks, payments, terms. Production: OData or BAPI via BTP. */
export const sapFi: Adapter = {
  system: "SAP FI",
  async execute(action, ctx) {
    const latency_ms = latencyFor(action, 550, 450);
    await sleep(latency_ms);
    const seq = ctx.nextSeq();
    return { doc_number: `19000${String(31800 + seq).padStart(5, "0")}`, latency_ms, status: "written", message: `${action.action} posted` };
  },
};
