"use client";

import { ChevronDown, Flag, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { fmtSgt } from "@/lib/dates";
import { PERSONAS, type PersonaId } from "@/lib/personas";
import { searchItems, type SearchItem } from "@/lib/search";
import { useStore } from "@/lib/store";

export function TopBar({ index }: { index: SearchItem[] }) {
  const persona = useStore((s) => s.persona);
  const clock = useStore((s) => s.clock);
  const setFlagOpen = useStore((s) => s.setFlagOpen);
  const setDevOpen = useStore((s) => s.setDevOpen);
  return (
    <header className="fixed left-[240px] right-0 top-0 z-20 flex h-14 items-center gap-4 whitespace-nowrap border-b border-rule bg-paper px-6">
      <GlobalSearch index={index} />
      <div className="ml-auto flex items-center gap-3 min-[1440px]:gap-4">
        <span className="mono border border-dashed border-rule-2 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-3">
          Prototype, synthetic data
        </span>
        <span className="text-[12.5px] text-ink-2" title="Business unit">Commercial Aerospace</span>
        <button
          onClick={() => setDevOpen(true)}
          className="group flex items-center gap-2 border-l border-rule pl-4 text-left"
          title="Simulated clock and demo controls"
        >
          <span>
            <span className="label block leading-none">Sim clock</span>
            <span className="tnum text-[12.5px]">{fmtSgt(clock)} SGT</span>
          </span>
          <SlidersHorizontal size={13} className="text-ink-3 group-hover:text-ink" />
        </button>
        <PersonaSwitcher value={persona} />
        <button
          onClick={() => setFlagOpen(true)}
          className="flex h-8 items-center gap-1.5 border border-rule-2 px-2.5 text-[12.5px] hover:border-ink"
          data-testid="flag-this"
        >
          <Flag size={13} strokeWidth={1.6} /> Flag this
        </button>
      </div>
    </header>
  );
}

function PersonaSwitcher({ value }: { value: PersonaId }) {
  const [open, setOpen] = useState(false);
  const setPersona = useStore((s) => s.setPersona);
  const p = PERSONAS[value];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 border-l border-rule pl-4" data-testid="persona-switcher">
        <span className="grid h-7 w-7 place-items-center border border-rule-2 text-[11px] font-medium">
          {p.name
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="text-left">
          <span className="block text-[13px] leading-tight">{p.name}</span>
          <span className="block text-[11px] leading-tight text-ink-3">{p.short}</span>
        </span>
        <ChevronDown size={13} className="text-ink-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-[300px] border border-rule-2 bg-paper">
          <div className="label border-b border-rule px-3 py-2">View as (framing only, no roles enforced)</div>
          {Object.values(PERSONAS).map((x) => (
            <button
              key={x.id}
              onClick={() => {
                setPersona(x.id);
                setOpen(false);
              }}
              className={cn("block w-full px-3 py-2.5 text-left hover:bg-paper-2", x.id === value && "bg-paper-2")}
            >
              <span className="block text-[13px]">{x.name}</span>
              <span className="block text-[11.5px] text-ink-3">{x.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalSearch({ index }: { index: SearchItem[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const results = useMemo(() => searchItems(index, q), [index, q]);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (it: SearchItem) => {
    setOpen(false);
    setQ("");
    router.push(it.href);
  };
  return (
    <div className="relative w-[260px] min-[1440px]:w-[380px]">
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setSel((s) => Math.min(results.length - 1, s + 1));
          if (e.key === "ArrowUp") setSel((s) => Math.max(0, s - 1));
          if (e.key === "Enter" && results[sel]) go(results[sel]);
          if (e.key === "Escape") inputRef.current?.blur();
        }}
        placeholder="Search suppliers, parts, POs"
        aria-label="Global search"
        className="h-8 w-full border border-rule bg-paper-2 pl-8 pr-12 text-[13px] placeholder:text-ink-3 focus:border-accent focus:bg-paper focus:outline-none"
      />
      <span className="mono pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 text-[10px] text-ink-3 min-[1440px]:inline">Ctrl K</span>
      {open && q && (
        <div className="absolute left-0 top-10 z-40 w-[520px] border border-rule-2 bg-paper">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-ink-3">No supplier, part or PO matches &ldquo;{q}&rdquo;.</div>
          ) : (
            results.map((r, i) => (
              <Link
                key={`${r.kind}-${r.id}`}
                href={r.href}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(r);
                }}
                className={cn("flex items-baseline gap-3 border-b border-rule px-3 py-2 last:border-b-0", i === sel && "bg-paper-2")}
              >
                <span className="label w-[72px] shrink-0">{r.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{r.label}</span>
                  <span className="mono block truncate text-[11px] text-ink-3">{r.sub}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
