import type { Metadata } from "next";
import { Scorecard } from "@/components/scorecard/scorecard";
import { scorecardData } from "@/lib/scorecard-data";

export const metadata: Metadata = { title: "Risk Scorecard" };

export default function ScorecardPage() {
  return <Scorecard data={scorecardData()} />;
}
