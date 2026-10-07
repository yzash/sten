import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "border-accent bg-accent text-white hover:bg-accent-ink hover:border-accent-ink",
        variant === "secondary" && "border-rule-2 bg-paper text-ink hover:border-ink",
        variant === "ghost" && "border-transparent bg-transparent text-ink-2 hover:text-ink hover:bg-paper-2",
        variant === "danger" && "border-sev-critical/50 bg-paper text-sev-critical hover:border-sev-critical",
        className,
      )}
    />
  );
}
