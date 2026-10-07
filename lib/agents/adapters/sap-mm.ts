import { latencyFor, sleep, type Adapter } from "../types";

/** Mock SAP MM: purchasing documents, inspection lots. Production: OData API_PURCHASEORDER_PROCESS_SRV or Joule A2A. */
export const sapMm: Adapter = {
  system: "SAP MM",
  async execute(action, ctx) {
    const latency_ms = latencyFor(action, 650, 500);
    await sleep(latency_ms);
    const seq = ctx.nextSeq();
    const doc_number =
      action.action === "create_inspection_lot" ? `04000${String(12900 + seq).padStart(5, "0")}` : `45000${String(20400 + seq).padStart(5, "0")}`;
    return { doc_number, latency_ms, status: "written", message: `${action.action} accepted` };
  },
};
