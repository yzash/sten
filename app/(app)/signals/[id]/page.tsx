import type { Metadata } from "next";
import { DraftWorkspace } from "@/components/workspace/draft-workspace";
import { Workspace } from "@/components/workspace/workspace";
import { redirect } from "next/navigation";
import { getSignal, listLibrarySignals, listSignals } from "@/lib/api";
import { workspaceFor } from "@/lib/workspace-data";

export const dynamicParams = true;

export function generateStaticParams() {
  return [...listSignals(), ...listLibrarySignals()].filter((s) => s.disposition !== "merged").map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function SignalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sig = getSignal(id);
  if (sig?.disposition === "merged" && sig.parent_id) redirect(`/signals/${sig.parent_id}`);
  const data = workspaceFor(id);
  if (!data) return <DraftWorkspace id={id} />;
  return <Workspace data={data} />;
}
