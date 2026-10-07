"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button[data-autofocus]")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 pt-[10vh]" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[80vh] overflow-hidden border border-rule-2 bg-paper flex flex-col"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-rule px-5 py-4">
          <div>
            {kicker && <div className="label mb-1">{kicker}</div>}
            <h2 className="text-[17px] font-medium tracking-[-0.01em]">{title}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} className="text-ink-3 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className={cn("flex justify-end gap-2 border-t border-rule px-5 py-3")}>{footer}</div>}
      </div>
    </div>
  );
}
