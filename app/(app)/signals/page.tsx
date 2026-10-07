import type { Metadata } from "next";
import { SignalFeed } from "@/components/signals/feed";
import { feedData } from "@/lib/view";

export const metadata: Metadata = { title: "Signals" };

export default function SignalsPage() {
  const d = feedData();
  return <SignalFeed signals={d.signals} library={d.library} suppliers={d.suppliers} />;
}
