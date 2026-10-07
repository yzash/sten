"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Tag } from "@/components/ui/tag";
import { classifyFreeText, type SupplierRef } from "@/lib/classify";
import { cn } from "@/lib/cn";
import { CHANNEL_LABELS, DISRUPTION_LABELS, type Signal } from "@/lib/schema";
import { useStore } from "@/lib/store";
import type { FeedSignal } from "@/lib/view";

export function InjectModal({ open, onClose, library, suppliers }: { open: boolean; onClose: () => void; library: FeedSignal[]; suppliers: SupplierRef[] }) {
  const router = useRouter();
  const inject = useStore((s) => s.inject);
  const addDraft = useStore((s) => s.addDraft);
  const injected = useStore((s) => s.injected);
  const drafts = useStore((s) => s.drafts);
  const clock = useStore((s) => s.clock);
  const [tab, setTab] = useState<"library" | "free">("library");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ signal: Signal; feed: FeedSignal } | null>(null);
  const [busy, setBusy] = useState(false);

  const classify = async () => {
    setBusy(true);
    const sig = classifyFreeText(text.trim(), suppliers, clock, drafts.length + 1);
    // Deterministic layer runs in the browser for drafts only.
    const { assess, getSupplier, getPart } = await import("@/lib/api");
    const a = assess(sig);
    const material = a.exposure.material;
    const signal: Signal = { ...sig, disposition: material ? "material" : "discarded", material, affected_po_line_ids: a.exposure.poLineIds, affected_part_ids: a.exposure.partIds, discard_reason: a.exposure.discardReason };
    const feed: FeedSignal = {
      id: signal.id,
      received_at: clock,
      channel: signal.channel,
      headline: signal.headline,
      type: signal.type,
      state: signal.state,
      confidence: signal.confidence,
      disposition: signal.disposition,
      parent_id: null,
      discard_reason: signal.discard_reason,
      checkpoint: signal.checkpoint,
      library: false,
      severity: material ? a.scores.overall.severity : null,
      driver: material ? a.scores.overall.driver : null,
      lines: a.exposure.poLineIds.length,
      value_usd: a.scores.cost.po_value_usd,
      supplier_ids: a.exposure.supplierIds,
      supplier_names: a.exposure.supplierIds.map((id) => getSupplier(id)?.name ?? id),
      categories: [...new Set(a.exposure.partIds.map((p) => getPart(p)?.category).filter((c): c is NonNullable<typeof c> => !!c))],
    };
    setDraft({ signal, feed });
    setBusy(false);
  };

  const close = () => {
    setDraft(null);
    setText("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} kicker="Demo and analyst use" title="Inject a signal" width={680}>
      <div className="mb-4 flex border-b border-rule">
        {(["library", "free"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b px-3 pb-2 text-[13px]", tab === t ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2")}
          >
            {t === "library" ? "Prewritten library" : "Free-text headline"}
          </button>
        ))}
      </div>
      {tab === "library" ? (
        <div className="divide-y divide-rule border-y border-rule">
          {library.map((l) => {
            const done = injected.some((i) => i.id === l.id);
            return (
              <div key={l.id} className="flex items-start gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] leading-snug">{l.headline}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                    <Tag tone="muted">{CHANNEL_LABELS[l.channel]}</Tag>
                    <span>{DISRUPTION_LABELS[l.type]}</span>
                    <span className="capitalize">{l.state}</span>
                    <span className="tnum">conf {l.confidence.toFixed(2)}</span>
                    <span className={l.disposition === "material" ? "text-ink-2" : ""}>{l.disposition === "material" ? `Material · ${l.lines} PO lines` : "Will be filtered out"}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={done ? "ghost" : "secondary"}
                  data-testid={`inject-${l.id}`}
                  onClick={() => {
                    inject(l.id);
                    close();
                    router.push(`/signals/${l.id}`);
                  }}
                >
                  {done ? "Open" : "Inject"}
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDraft(null);
            }}
            placeholder="e.g. Flooding closes Penang industrial park for 5 days"
            aria-label="Free-text headline"
          />
          <p className="mt-2 text-[12px] text-ink-3">
            Free text gets a rules-based best guess at confidence 0.60 and a draft badge. The materiality filter and impact scoring run for real; options need the reasoning service, so a draft shows exposure and impact only.
          </p>
          {draft && (
            <div className="mt-4 border border-rule-2 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Tag tone="draft">Draft</Tag>
                <span className="mono text-[12px] text-ink-3">{draft.signal.id}</span>
              </div>
              <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[13px]">
                <dt className="label pt-0.5">Type</dt>
                <dd>{DISRUPTION_LABELS[draft.signal.type]}</dd>
                <dt className="label pt-0.5">State</dt>
                <dd className="capitalize">{draft.signal.state}</dd>
                <dt className="label pt-0.5">Confidence</dt>
                <dd className="tnum">0.60</dd>
                <dt className="label pt-0.5">Matched</dt>
                <dd className="text-ink-2">
                  {[
                    ...draft.feed.supplier_names,
                    ...draft.signal.affected_regions.map((r) => `region ${r}`),
                    ...draft.signal.affected_corridors.map((c) => `corridor ${c}`),
                  ].join(", ") || "No supplier, region or corridor recognised"}
                </dd>
                <dt className="label pt-0.5">Materiality</dt>
                <dd>{draft.signal.material ? `Material · ${draft.feed.lines} open PO lines` : draft.signal.discard_reason}</dd>
              </dl>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {!draft ? (
              <Button variant="secondary" onClick={classify} disabled={text.trim().length < 8 || busy}>
                {busy ? "Classifying" : "Classify"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => {
                  addDraft(draft);
                  close();
                  router.push(`/signals/${draft.signal.id}`);
                }}
              >
                Add to feed and open
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
