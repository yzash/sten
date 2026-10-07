import type { Metadata } from "next";
import { PageHeader, SectionHead, Stat } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { usd } from "@/lib/format";
import { predictScenario } from "@/lib/predict-data";

export const metadata: Metadata = { title: "Predict" };

const AVOID = [
  { a: "Qualify Prairie Composites as a US source for inlet and exhaust acoustic panels", effect: "Removes origin exposure on US-routed work", lead: "14 weeks", owner: "Sourcing" },
  { a: "Route EU-origin nacelle parts direct to Singapore, avoiding US bonded transit", effect: "Most of the duty base disappears on day one", lead: "2 weeks", owner: "Logistics" },
  { a: "Pull forward Q1 2027 panel demand into November shipments", effect: "Lands volume before any effective date", lead: "4 weeks", owner: "Purchasing" },
  { a: "Add a tariff-change clause to the Weser and Rhone frame agreements at renewal", effect: "Shares duty risk with suppliers", lead: "Next renewal", owner: "Category manager" },
];

export default function PredictPage() {
  const s = predictScenario();
  return (
    <div>
      <PageHeader
        kicker="Prediction layer · strategic, before it hits"
        title="Predict"
        sub="The MVP is operational: it responds after impact. This page shows where the prediction layer sits, with one illustrative scenario. It is static and prebuilt."
      />
      <div className="max-w-[1080px] px-8 py-6">
        <div className="border border-rule-2" data-testid="predict-card">
          <div className="flex items-start justify-between border-b border-rule px-6 py-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Tag>Tariff</Tag>
                <Tag tone="muted">Strategic</Tag>
                <span className="mono text-[11px] text-ink-3">SCN-01</span>
              </div>
              <h2 className="text-[20px] font-medium tracking-[-0.01em]">US extends 25% duty to all EU-origin nacelle parts</h2>
              <p className="mt-1.5 max-w-[680px] text-[13.5px] text-ink-2">
                After the 1 Nov reclassification of acoustic panels, trade press and two broker advisories point to a wider review of EU-origin nacelle components. If it lands, every EU nacelle part moving through US bonded facilities carries the duty.
              </p>
            </div>
          </div>
          <div className="flex gap-12 border-b border-rule px-6 py-5">
            <Stat label="Probability of impact" value={`${Math.round(s.probability * 100)}%`} sub="within 6 months" />
            <Stat label="Exposure if it lands" value={usd(s.exposure, { compact: true })} sub={`25% on ${usd(s.open_value, { compact: true })} open`} />
            <Stat label="Open PO lines" value={s.lines} sub={`${s.suppliers.length} EU suppliers`} />
            <Stat label="Time to act" value="8 to 14 wk" sub="before a likely effective date" />
          </div>
          <div className="px-6 py-5">
            <SectionHead label="Avoid actions" />
            <table className="w-full text-[13px]">
              <tbody>
                {AVOID.map((x) => (
                  <tr key={x.a} className="border-b border-rule align-top">
                    <td className="py-3 pr-4">{x.a}</td>
                    <td className="py-3 pr-4 text-ink-2">{x.effect}</td>
                    <td className="tnum whitespace-nowrap py-3 pr-4 text-ink-2">{x.lead}</td>
                    <td className="whitespace-nowrap py-3 text-ink-3">{x.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[12.5px] text-ink-3">Suppliers in scope: {s.suppliers.join(", ")}.</p>
          </div>
        </div>
        <p className="accent-line mt-6 max-w-[760px] text-[15px] text-ink-2">
          In production the same engine scores strategic signals against forward demand rather than open POs, and the avoid actions become sourcing tasks with owners and dates.
        </p>
      </div>
    </div>
  );
}
