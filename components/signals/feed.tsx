"use client";

import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { PageHeader, Stat } from "@/components/ui/section";
import { SeverityNumber } from "@/components/ui/severity";
import { Tag } from "@/components/ui/tag";
import type { SupplierRef } from "@/lib/classify";
import { cn } from "@/lib/cn";
import { fmtSgt } from "@/lib/dates";
import { usd } from "@/lib/format";
import { CHANNEL_LABELS, DISRUPTION_LABELS, DISRUPTION_TYPES, PART_CATEGORIES, PART_CATEGORY_LABELS, type DisruptionType, type PartCategory } from "@/lib/schema";
import { useStore } from "@/lib/store";
import type { FeedSignal } from "@/lib/view";
import { InjectModal } from "./inject-modal";

const WINDOWS = [
  { id: "72h", label: "Last 72 hours", hours: 72 },
  { id: "7d", label: "Last 7 days", hours: 168 },
  { id: "14d", label: "Last 14 days", hours: 336 },
] as const;

export function SignalFeed({ signals, library, suppliers }: { signals: FeedSignal[]; library: FeedSignal[]; suppliers: SupplierRef[] }) {
  const clock = useStore((s) => s.clock);
  const injected = useStore((s) => s.injected);
  const drafts = useStore((s) => s.drafts);
  const overrides = useStore((s) => s.overrides);
  const [win, setWin] = useState<(typeof WINDOWS)[number]["id"]>("72h");
  const [type, setType] = useState<DisruptionType | "">("");
  const [state, setState] = useState<"" | "strategic" | "operational">("");
  const [mat, setMat] = useState<"" | "material" | "discarded">("");
  const [supplier, setSupplier] = useState("");
  const [cat, setCat] = useState<PartCategory | "">("");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [injectOpen, setInjectOpen] = useState(false);

  const all = useMemo(() => {
    const injectedRows: FeedSignal[] = injected
      .map((inj) => {
        const lib = library.find((l) => l.id === inj.id);
        const draft = drafts.find((d) => d.signal.id === inj.id)?.feed;
        if (lib) return { ...lib, received_at: inj.at };
        if (draft) return { ...draft, received_at: inj.at };
        return null;
      })
      .filter(Boolean) as FeedSignal[];
    return [...injectedRows, ...signals].map((s) => {
      const o = overrides[s.id];
      if (!o) return s;
      return {
        ...s,
        type: o.type ?? s.type,
        disposition: o.material === undefined || s.disposition === "merged" ? s.disposition : o.material ? "material" : "discarded",
        discard_reason: o.material === false ? "Marked not material by analyst override" : s.discard_reason,
      } as FeedSignal;
    });
  }, [signals, library, injected, drafts, overrides]);

  const now = Date.parse(clock);
  const hours = WINDOWS.find((w) => w.id === win)!.hours;
  const inWindow = all.filter((s) => {
    const t = Date.parse(s.received_at);
    return t <= now && t >= now - hours * 3_600_000;
  });

  const passes = (s: FeedSignal) =>
    (!type || s.type === type) &&
    (!state || s.state === state) &&
    (!supplier || s.supplier_ids.includes(supplier)) &&
    (!cat || s.categories.includes(cat));

  const merged = inWindow.filter((s) => s.disposition === "merged");
  const mergedByParent = new Map<string, FeedSignal[]>();
  for (const m of merged) mergedByParent.set(m.parent_id!, [...(mergedByParent.get(m.parent_id!) ?? []), m]);

  const material = inWindow.filter((s) => s.disposition === "material" && passes(s) && mat !== "discarded").sort((a, b) => b.received_at.localeCompare(a.received_at));
  const discarded = inWindow.filter((s) => s.disposition === "discarded" && passes(s) && mat !== "material").sort((a, b) => b.received_at.localeCompare(a.received_at));

  const counts = {
    received: inWindow.length,
    material: inWindow.filter((s) => s.disposition === "material").length,
    merged: merged.length,
    discarded: inWindow.filter((s) => s.disposition === "discarded").length,
  };
  const filtersOn = !!(type || state || mat || supplier || cat);
  const supplierOpts = suppliers.filter((s) => all.some((x) => x.supplier_ids.includes(s.id)));

  return (
    <div>
      <PageHeader
        kicker="Pre-P2P · feeds every checkpoint"
        title="Signal Feed"
        sub="Every disruption signal from mail, news, credit monitoring, SAP events, forwarder EDI and Sphera, classified and filtered for material impact on open POs, approved suppliers and in-transit shipments."
        right={
          <Button variant="secondary" onClick={() => setInjectOpen(true)} data-testid="inject-open">
            <Plus size={14} /> Inject a signal
          </Button>
        }
      />
      <div className="flex items-end gap-10 border-b border-rule px-8 py-5">
        <Stat label="Received" value={counts.received} sub={WINDOWS.find((w) => w.id === win)!.label.toLowerCase()} />
        <Stat label="Material" value={<span data-testid="material-count">{counts.material}</span>} sub="maps to open exposure" />
        <Stat label="Merged" value={counts.merged} sub="corroborating duplicates" />
        <Stat label="Filtered out" value={counts.discarded} sub="no exposure found" />
        <div className="ml-auto max-w-[360px] text-[12px] leading-snug text-ink-3">
          A signal is material when it maps to at least one open PO line, approved supplier or in-transit shipment. Everything else is kept, with the reason.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-8 py-3">
        <Select value={win} onChange={(e) => setWin(e.target.value as typeof win)} aria-label="Time window" className="w-[140px]">
          {WINDOWS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as DisruptionType)} aria-label="Type" className="w-[210px]">
          <option value="">All disruption types</option>
          {DISRUPTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {DISRUPTION_LABELS[t]}
            </option>
          ))}
        </Select>
        <Select value={state} onChange={(e) => setState(e.target.value as typeof state)} aria-label="State" className="w-[140px]">
          <option value="">Any state</option>
          <option value="operational">Operational</option>
          <option value="strategic">Strategic</option>
        </Select>
        <Select value={mat} onChange={(e) => setMat(e.target.value as typeof mat)} aria-label="Materiality" className="w-[150px]">
          <option value="">Material and filtered</option>
          <option value="material">Material only</option>
          <option value="discarded">Filtered out only</option>
        </Select>
        <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Supplier" className="w-[220px]">
          <option value="">Any supplier</option>
          {supplierOpts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value as PartCategory)} aria-label="Part category" className="w-[170px]">
          <option value="">Any part category</option>
          {PART_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PART_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        {filtersOn && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setType("");
              setState("");
              setMat("");
              setSupplier("");
              setCat("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="px-8 pb-16">
        <div className="grid grid-cols-[96px_70px_1fr_190px_100px_52px_56px] items-center gap-4 border-b border-rule py-2">
          {["Received", "Channel", "Headline", "Type", "State", "Conf.", "Sev."].map((h, i) => (
            <span key={h} className={cn("label", i >= 5 && "text-right")}>
              {h}
            </span>
          ))}
        </div>
        {material.length === 0 && mat !== "discarded" && (
          <div className="border-b border-rule py-8 text-[13.5px] text-ink-2">
            No material signals {filtersOn ? "match these filters" : "in this window"}. {filtersOn ? "Clear a filter to widen the view." : "Widen the time window or rewind the clock in the dev drawer."}
          </div>
        )}
        {material.map((s) => (
          <SignalRow key={s.id} s={s} merged={mergedByParent.get(s.id) ?? []} />
        ))}

        {mat !== "material" && (
          <div className="mt-6">
            <button
              onClick={() => setShowDiscarded(!showDiscarded)}
              className="flex w-full items-center gap-2 border-b border-rule py-2.5 text-left"
              data-testid="filtered-toggle"
              aria-expanded={showDiscarded || mat === "discarded"}
            >
              {showDiscarded || mat === "discarded" ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="text-[13.5px]">Filtered out</span>
              <span className="tnum text-[12px] text-ink-3">{discarded.length}</span>
              <span className="ml-3 text-[12.5px] text-ink-3">Kept for audit. Each shows which exposure checks came back empty.</span>
            </button>
            {(showDiscarded || mat === "discarded") &&
              (discarded.length === 0 ? (
                <div className="py-4 text-[13px] text-ink-3">Nothing was filtered out in this window.</div>
              ) : (
                discarded.map((s) => <SignalRow key={s.id} s={s} merged={[]} quiet />)
              ))}
          </div>
        )}
      </div>
      <InjectModal open={injectOpen} onClose={() => setInjectOpen(false)} library={library} suppliers={suppliers} />
    </div>
  );
}

function SignalRow({ s, merged, quiet }: { s: FeedSignal; merged: FeedSignal[]; quiet?: boolean }) {
  const [open, setOpen] = useState(false);
  const isDraft = s.id.startsWith("DRAFT");
  return (
    <div className="border-b border-rule" data-testid={`signal-row-${s.id}`}>
      <Link href={`/signals/${s.id}`} className={cn("grid grid-cols-[96px_70px_1fr_190px_100px_52px_56px] items-start gap-4 py-3 hover:bg-paper-2", quiet && "text-ink-2")}>
        <span className="tnum pt-px text-[12px] text-ink-2">{fmtSgt(s.received_at)}</span>
        <span className="pt-px">
          <Tag tone={quiet ? "muted" : "default"}>{CHANNEL_LABELS[s.channel]}</Tag>
        </span>
        <span className="min-w-0">
          <span className={cn("block text-[13.5px] leading-snug", !quiet && "text-ink")}>{s.headline}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
            <span className="mono">{s.id}</span>
            {isDraft && <Tag tone="draft">Draft</Tag>}
            {s.library && <Tag tone="muted">Injected</Tag>}
            {quiet ? (
              <span className="text-ink-2">{s.discard_reason}</span>
            ) : (
              <>
                {s.supplier_names.length > 0 && <span>{s.supplier_names.slice(0, 2).join(", ")}{s.supplier_names.length > 2 ? ` +${s.supplier_names.length - 2}` : ""}</span>}
                {s.lines > 0 && (
                  <span className="tnum">
                    {s.lines} PO line{s.lines === 1 ? "" : "s"} · {usd(s.value_usd, { compact: true })}
                  </span>
                )}
              </>
            )}
          </span>
        </span>
        <span className="pt-px text-[12.5px]">{DISRUPTION_LABELS[s.type]}</span>
        <span className="pt-px text-[12.5px] capitalize text-ink-2">{s.state}</span>
        <span className="tnum pt-px text-right text-[12.5px] text-ink-2">{s.confidence.toFixed(2)}</span>
        <span className="pt-px text-right text-[13px]">{s.severity != null ? <SeverityNumber value={s.severity} /> : <span className="text-ink-3">n/a</span>}</span>
      </Link>
      {merged.length > 0 && (
        <div className="pb-2.5 pl-[182px]">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-[12px] text-ink-2 hover:text-ink">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {merged.length} corroborating signal{merged.length === 1 ? "" : "s"} merged
            <span className="ml-1 flex gap-1">
              {merged.map((m) => (
                <Tag key={m.id} tone="muted">
                  {CHANNEL_LABELS[m.channel]}
                </Tag>
              ))}
            </span>
          </button>
          {open && (
            <div className="mt-2 space-y-1.5 border-l border-rule pl-3">
              {merged
                .sort((a, b) => a.received_at.localeCompare(b.received_at))
                .map((m) => (
                  <div key={m.id} className="flex gap-3 text-[12.5px]">
                    <span className="tnum w-[84px] shrink-0 text-ink-3">{fmtSgt(m.received_at)}</span>
                    <Tag tone="muted">{CHANNEL_LABELS[m.channel]}</Tag>
                    <span className="text-ink-2">{m.headline}</span>
                    <span className="mono text-ink-3">{m.id}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
