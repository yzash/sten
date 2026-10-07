"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { WorkspaceData } from "@/lib/workspace-data";
import { Workspace } from "./workspace";

/** Free-text drafts live only in this browser, so their workspace is assembled client-side. */
export function DraftWorkspace({ id }: { id: string }) {
  const hydrated = useStore((s) => s.hydrated);
  const draft = useStore((s) => s.drafts.find((d) => d.signal.id === id));
  const [data, setData] = useState<WorkspaceData | null>(null);
  useEffect(() => {
    if (!draft) return;
    void import("@/lib/workspace-data").then((m) => setData(m.assembleWorkspace(draft.signal)));
  }, [draft]);
  if (!hydrated) return <div className="px-8 py-10 text-[13px] text-ink-3">Loading signal</div>;
  if (!draft)
    return (
      <div className="px-8 py-10">
        <div className="label mb-2">Signal not found</div>
        <p className="mb-3 text-[14px]">{id} is not in the feed or in this browser&rsquo;s injected drafts.</p>
        <Link href="/signals" className="text-[13px] underline">
          Back to Signals
        </Link>
      </div>
    );
  if (!data) return <div className="px-8 py-10 text-[13px] text-ink-3">Running the materiality filter and impact scoring</div>;
  return <Workspace data={data} draft />;
}
