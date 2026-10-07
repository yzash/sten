import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";
import { workspaceFor } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Warehouse" };

export default function Page() {
  const data = workspaceFor("SIG-0019")!;
  return <Workspace data={data} stub={{ title: "Checkpoint 4 · Warehouse · Accept or hold GR", banner: "The full version reads WMS stock and QM inspection lots live and drafts the goods receipt decision and stock reallocation for every inbound delivery." }} />;
}
