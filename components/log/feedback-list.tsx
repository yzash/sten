"use client";

import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/section";
import { downloadCsv } from "@/lib/csv";
import { fmtSgt } from "@/lib/dates";
import { PERSONAS } from "@/lib/personas";
import { useStore } from "@/lib/store";

export function FeedbackList() {
  const feedback = useStore((s) => s.feedback);
  const hydrated = useStore((s) => s.hydrated);
  const remove = useStore((s) => s.removeFeedback);
  const setOpen = useStore((s) => s.setFlagOpen);
  return (
    <div>
      <PageHeader
        kicker="Session capture"
        title="Feedback"
        sub="Notes captured with Flag this during the walkthrough. Stored in this browser; export to CSV to take them away."
        right={
          <>
            <Button onClick={() => setOpen(true)}>Add a note</Button>
            <Button
              variant="primary"
              disabled={feedback.length === 0}
              data-testid="feedback-export"
              onClick={() =>
                downloadCsv(
                  "feedback.csv",
                  feedback.map((f) => ({ id: f.id, time_sgt: fmtSgt(f.at), screen: f.screen, persona: PERSONAS[f.persona].name, what_is_wrong: f.wrong, what_is_missing: f.missing, who_would_own_this: f.owner })),
                )
              }
            >
              <Download size={14} /> Export CSV
            </Button>
          </>
        }
      />
      <div className="px-8 pb-12">
        {!hydrated ? null : feedback.length === 0 ? (
          <div className="py-12">
            <div className="label mb-2">No notes yet</div>
            <p className="max-w-[520px] text-[13.5px] text-ink-2">Use Flag this in the top bar on any screen. The screen, persona and time are filled in for you.</p>
          </div>
        ) : (
          <table className="w-full text-[13px]" data-testid="feedback-table">
            <thead>
              <tr className="border-b border-rule">
                {["Time (SGT)", "Screen", "Persona", "What is wrong", "What is missing", "Owner", ""].map((h) => (
                  <th key={h} className="label py-2 text-left font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id} className="border-b border-rule align-top">
                  <td className="tnum whitespace-nowrap py-2.5 pr-3 text-[12px]">{fmtSgt(f.at)}</td>
                  <td className="mono py-2.5 pr-3 text-[12px]">{f.screen}</td>
                  <td className="py-2.5 pr-3">{PERSONAS[f.persona].name}</td>
                  <td className="max-w-[300px] py-2.5 pr-3">{f.wrong || <span className="text-ink-3">none</span>}</td>
                  <td className="max-w-[300px] py-2.5 pr-3">{f.missing || <span className="text-ink-3">none</span>}</td>
                  <td className="py-2.5 pr-3">{f.owner || <span className="text-ink-3">none</span>}</td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => remove(f.id)} aria-label="Delete note" className="text-ink-3 hover:text-sev-critical">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
