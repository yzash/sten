export type PersonaId = "buyer" | "manager" | "analyst";
export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  short: string;
}
export const PERSONAS: Record<PersonaId, Persona> = {
  buyer: { id: "buyer", name: "Mei Lin Tan", role: "Category Buyer, Engine Components", short: "Buyer" },
  manager: { id: "manager", name: "Rajiv Menon", role: "Procurement Manager, Commercial Aerospace", short: "Manager" },
  analyst: { id: "analyst", name: "Daniel Koh", role: "Supply Chain Analyst", short: "Analyst" },
};
export const DEFAULT_CLOCK = "2026-10-07T00:30:00.000Z"; // 7 Oct 2026 08:30 SGT
