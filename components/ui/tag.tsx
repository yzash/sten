import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** Small mono tag. Channels and IDs use this, never colour. */
export function Tag({ children, className, tone = "default", title }: { children: ReactNode; className?: string; tone?: "default" | "accent" | "muted" | "draft"; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "mono inline-flex h-[18px] shrink-0 items-center border px-1.5 text-[10px] leading-none tracking-[0.04em] uppercase",
        tone === "default" && "border-rule-2 text-ink-2",
        tone === "muted" && "border-rule text-ink-3",
        tone === "accent" && "border-accent text-accent",
        tone === "draft" && "border-dashed border-ink-3 text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
