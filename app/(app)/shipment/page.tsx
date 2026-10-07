import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";
import { workspaceFor } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Shipment" };

export default function Page() {
  const data = workspaceFor("SIG-0015")!;
  return <Workspace data={data} stub={{ title: "Checkpoint 3 · Shipment · Reroute plan", banner: "The full version watches every in-transit shipment through forwarder EDI and books reroutes through the forwarder API, rather than one seeded case." }} />;
}
