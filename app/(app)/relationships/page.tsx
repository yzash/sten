import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/workspace";
import { workspaceFor } from "@/lib/workspace-data";

export const metadata: Metadata = { title: "Relationships" };

export default function Page() {
  const data = workspaceFor("SIG-0024")!;
  return <Workspace data={data} stub={{ title: "Checkpoint 5 · Invoice and Pay · Relationship insights", banner: "The full version scores every strategic supplier on payment ageing, disputes and spend trend from SAP FI and proposes terms changes across the portfolio." }} />;
}
