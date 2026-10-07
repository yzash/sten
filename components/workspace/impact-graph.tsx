"use client";

import { motion } from "framer-motion";
import { Maximize2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { LAYERS, type ChainEdge, type ChainNode } from "@/lib/impact-chain";

interface Placed extends ChainNode {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Geometry {
  nodes: Placed[];
  edges: (ChainEdge & { d: string; mx: number; my: number })[];
  width: number;
  height: number;
  layerX: number[];
}

/** Layered left-to-right layout. No force simulation: positions are a pure function of the chain. */
function layout(nodes: ChainNode[], edges: ChainEdge[], width: number, full: boolean): Geometry {
  const gap = full ? 30 : 10;
  const nodeW = full ? Math.max(150, (width - 5 * gap) / 6) : Math.max(54, (width - 5 * gap) / 6);
  const nodeH = full ? 62 : 36;
  const vGap = full ? 14 : 10;
  const top = 26;

  const byLayer: ChainNode[][] = Array.from({ length: 6 }, () => []);
  for (const n of nodes) byLayer[n.layer].push(n);

  // Order each layer by the mean position of its parents (one barycentre pass is enough for a tree-like chain).
  const pos = new Map<string, number>();
  byLayer.forEach((layer, li) => {
    if (li > 0) {
      layer.sort((a, b) => bary(a) - bary(b));
    }
    layer.forEach((n, i) => pos.set(n.id, i));
    function bary(n: ChainNode) {
      const parents = edges.filter((e) => e.to === n.id).map((e) => pos.get(e.from) ?? 0);
      const v = parents.length ? parents.reduce((s, x) => s + x, 0) / parents.length : 99;
      return n.kind === "aggregate" ? 999 : v;
    }
  });

  const maxRows = Math.max(...byLayer.map((l) => l.length), 1);
  const colH = maxRows * nodeH + (maxRows - 1) * vGap;
  const placed: Placed[] = [];
  byLayer.forEach((layer, li) => {
    const h = layer.length * nodeH + Math.max(0, layer.length - 1) * vGap;
    const y0 = top + (colH - h) / 2;
    layer.forEach((n, i) => placed.push({ ...n, x: li * (nodeW + gap), y: y0 + i * (nodeH + vGap), w: nodeW, h: nodeH }));
  });
  const idx = new Map(placed.map((p) => [p.id, p]));
  const geoEdges = edges
    .filter((e) => idx.has(e.from) && idx.has(e.to))
    .map((e) => {
      const a = idx.get(e.from)!;
      const b = idx.get(e.to)!;
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const c = (x2 - x1) / 2;
      return { ...e, d: `M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
    });
  return {
    nodes: placed,
    edges: geoEdges,
    width: 6 * nodeW + 5 * gap,
    height: top + colH + 8,
    layerX: Array.from({ length: 6 }, (_, i) => i * (nodeW + gap)),
  };
}

function Graph({ nodes, edges, width, full }: { nodes: ChainNode[]; edges: ChainEdge[]; width: number; full: boolean }) {
  const g = useMemo(() => layout(nodes, edges, width, full), [nodes, edges, width, full]);
  const [hover, setHover] = useState<Placed | null>(null);
  const showLabel = (e: ChainEdge, toKind: ChainNode["kind"] | undefined) =>
    e.slip_days !== null && (full || toKind === "work_order" || toKind === "milestone" || toKind === "requirement");
  const kindOf = new Map(g.nodes.map((n) => [n.id, n.kind]));
  const nodeW = g.nodes[0]?.w ?? 60;

  return (
    <div className="relative" style={{ width: g.width, height: g.height }}>
      <motion.svg
        width={g.width}
        height={g.height}
        className="absolute inset-0 overflow-visible"
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        role="img"
        aria-label="Impact chain from signal to redelivery milestone"
      >
        {LAYERS.map((l, i) => (
          <text key={l} x={g.layerX[i]} y={10} className="mono" fontSize={full ? 10 : 8.5} letterSpacing="0.06em" fill="var(--ink-3)">
            {(full ? l : l.split(" ")[0]).toUpperCase()}
          </text>
        ))}
        {g.edges.map((e, i) => (
          <path key={i} d={e.d} fill="none" stroke={e.highlight ? "var(--accent)" : "var(--rule-2)"} strokeWidth={e.highlight ? 1.4 : 1} />
        ))}
        {g.edges.map((e, i) =>
          showLabel(e, kindOf.get(e.to)) ? (
            <g key={`l${i}`} transform={`translate(${e.mx},${e.my})`}>
              <rect x={full ? -17 : -13} y={-6.5} width={full ? 34 : 26} height={13} fill="var(--paper)" />
              <text textAnchor="middle" y={3.5} fontSize={full ? 10 : 8.5} className="mono" fill={e.highlight ? "var(--accent)" : e.slip_days ? "var(--ink-2)" : "var(--ink-3)"}>
                {e.slip_days ? `+${e.slip_days}d` : "0d"}
              </text>
            </g>
          ) : null,
        )}
        {g.nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            className="cursor-default"
          >
            <rect
              width={n.w}
              height={n.h}
              fill={n.highlight ? "var(--accent-wash)" : n.kind === "signal" ? "var(--ink)" : "var(--paper)"}
              stroke={n.highlight ? "var(--accent)" : n.kind === "aggregate" ? "var(--rule-2)" : "var(--rule-2)"}
              strokeDasharray={n.kind === "aggregate" ? "3 2" : undefined}
            />
            {full ? (
              <>
                <text x={8} y={17} fontSize={11.5} fill={n.kind === "signal" ? "var(--paper)" : n.highlight ? "var(--accent-ink)" : "var(--ink)"} className="mono">
                  {clip(n.title, Math.floor(nodeW / 7))}
                </text>
                <text x={8} y={33} fontSize={10.5} fill={n.kind === "signal" ? "rgba(251,251,249,0.75)" : "var(--ink-2)"}>
                  {clip(n.sub, Math.floor(nodeW / 5.6))}
                </text>
                {n.meta && (
                  <text x={8} y={49} fontSize={10} className="mono" fill={n.kind === "signal" ? "rgba(251,251,249,0.6)" : "var(--ink-3)"}>
                    {clip(n.meta, Math.floor(nodeW / 6.2))}
                  </text>
                )}
              </>
            ) : (
              <>
                <text x={4} y={14} fontSize={9} className="mono" fill={n.kind === "signal" ? "var(--paper)" : n.highlight ? "var(--accent-ink)" : "var(--ink)"}>
                  {clip(n.short, Math.floor((nodeW - 6) / 5.45))}
                </text>
                <text x={4} y={27} fontSize={8} className="mono" fill={n.kind === "signal" ? "rgba(251,251,249,0.7)" : "var(--ink-3)"}>
                  {clip(n.short2, Math.floor((nodeW - 6) / 4.85))}
                </text>
              </>
            )}
          </g>
        ))}
      </motion.svg>
      {hover && !full && (
        <div
          className="pointer-events-none absolute z-10 w-[220px] border border-rule-2 bg-paper px-3 py-2 text-[12px]"
          style={{ left: Math.min(hover.x, g.width - 220), top: hover.y + hover.h + 6 }}
        >
          <div className="mono text-[11.5px]">{hover.title}</div>
          <div className="text-ink-2">{hover.sub}</div>
          {hover.meta && <div className="mono mt-0.5 text-[11px] text-ink-3">{hover.meta}</div>}
        </div>
      )}
      {full &&
        g.nodes
          .filter((n) => n.href)
          .map((n) => (
            <Link key={n.id} href={n.href!} className="absolute" style={{ left: n.x, top: n.y, width: n.w, height: n.h }} aria-label={n.title} />
          ))}
    </div>
  );
}

function clip(s: string, n: number) {
  return s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s;
}

export function ImpactGraph({ nodes, edges }: { nodes: ChainNode[]; edges: ChainEdge[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const hot = nodes.filter((n) => n.kind === "milestone" && n.highlight);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] text-ink-2">
          {hot.length ? (
            <>
              <span className="text-accent">{hot.length} redelivery{hot.length === 1 ? "" : "ies"} move</span> beyond float. Edges carry days of slip.
            </>
          ) : (
            "Slip is absorbed by float on every affected work order. Edges carry days of slip."
          )}
        </span>
        <button onClick={() => setExpanded(true)} className="flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink" data-testid="expand-chain">
          <Maximize2 size={12} /> Expand
        </button>
      </div>
      <div ref={ref} className={cn("w-full overflow-x-auto")} data-testid="impact-chain">
        {w > 0 && <Graph nodes={nodes} edges={edges} width={w} full={w >= 900} />}
      </div>
      <Modal open={expanded} onClose={() => setExpanded(false)} kicker="Impact chain" title="Signal to redelivery milestone" width={1180}>
        <div className="overflow-x-auto pb-2">
          <Graph nodes={nodes} edges={edges} width={1120} full />
        </div>
      </Modal>
    </div>
  );
}
