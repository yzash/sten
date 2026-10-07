"use client";

import { Modal } from "@/components/ui/modal";
import { usd } from "@/lib/format";
import { DISRUPTION_LABELS, type Precedent } from "@/lib/schema";

export function PrecedentModal({ precedent, onClose, names }: { precedent: Precedent | null; onClose: () => void; names?: Record<string, string> }) {
  if (!precedent) return null;
  const p = precedent;
  return (
    <Modal open onClose={onClose} kicker={`What did we do last time · ${p.id} · ${p.year}`} title={p.title} width={620}>
      <PrecedentBody p={p} names={names} />
    </Modal>
  );
}

export function PrecedentBody({ p, names }: { p: Precedent; names?: Record<string, string> }) {
  return (
    <div className="space-y-4 text-[13px]" data-testid="precedent">
      <div className="flex gap-6">
        <div>
          <div className="label">Type</div>
          {DISRUPTION_LABELS[p.signal_type]}
        </div>
        <div>
          <div className="label">Cost</div>
          <span className="tnum">{p.cost_usd < 0 ? `saved ${usd(-p.cost_usd)}` : usd(p.cost_usd)}</span>
        </div>
        <div>
          <div className="label">Delay</div>
          <span className="tnum">{p.delay_days}d</span>
        </div>
      </div>
      <p className="leading-relaxed text-ink-2">{p.summary}</p>
      <div>
        <div className="label mb-1">Options considered</div>
        <ul className="space-y-1">
          {p.options_considered.map((o) => (
            <li key={o} className="flex gap-2">
              <span className={o === p.option_taken || p.option_taken.startsWith(o) ? "text-ink" : "text-ink-3"}>{o === p.option_taken || p.option_taken.startsWith(o) ? "Taken" : "Considered"}</span>
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="label mb-1">Option taken</div>
        {p.option_taken}
      </div>
      <div>
        <div className="label mb-1">Outcome</div>
        <span className="text-ink-2">{p.outcome}</span>
      </div>
      <div className="border-t border-rule pt-3">
        <div className="label mb-1">Lesson</div>
        <p className="accent-line text-[15px] leading-snug">{p.lesson}</p>
      </div>
      {p.supplier_ids.length > 0 && names && (
        <div className="text-[12px] text-ink-3">Suppliers involved: {p.supplier_ids.map((id) => names[id] ?? id).join(", ")}</div>
      )}
    </div>
  );
}
