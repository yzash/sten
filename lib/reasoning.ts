import { REASONING } from "./reasoning-index";
import type { Reasoning } from "./schema";

/** Loads the prebuilt reasoning for a signal (generated at build time, never at request time). */
export function getReasoning(signalId: string): Reasoning | undefined {
  return REASONING[signalId];
}
