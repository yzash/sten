import type { Metadata } from "next";
import { ExecutionLog } from "@/components/log/log";

export const metadata: Metadata = { title: "Execution Log" };

export default function LogPage() {
  return <ExecutionLog />;
}
