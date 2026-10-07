/** Reads that mimic Sphera supplier risk and the sourcing workbench. */
import { db } from "./data";
import type { DiversificationRec, SourcingCall } from "@/lib/schema";

export function listDiversificationRecs(): DiversificationRec[] {
  return db.diversification;
}
export function listSourcingCalls(): SourcingCall[] {
  return db.sourcingCalls;
}
