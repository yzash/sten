import { Shell } from "@/components/shell/shell";
import { buildSearchIndex } from "@/lib/search-index";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell index={buildSearchIndex()}>{children}</Shell>;
}
