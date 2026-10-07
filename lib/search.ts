export interface SearchItem {
  kind: "Supplier" | "Part" | "PO" | "Signal" | "Work order";
  id: string;
  label: string;
  sub: string;
  href: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Small client-side fuzzy scorer: substring hits beat in-order subsequence hits; shorter gaps score higher. */
export function fuzzyScore(query: string, text: string): number {
  const q = norm(query).trim();
  const t = norm(text);
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 - idx * 2 - (t.length - q.length) * 0.1 + (idx === 0 || t[idx - 1] === " " ? 50 : 0);
  let ti = 0;
  let score = 0;
  let last = -1;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    score += last >= 0 ? Math.max(0, 10 - (found - last)) : 5;
    last = found;
    ti = found + 1;
  }
  return score;
}

export function searchItems(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  if (!query.trim()) return [];
  return items
    .map((it) => ({ it, s: Math.max(fuzzyScore(query, it.label), fuzzyScore(query, it.id) + 20, fuzzyScore(query, it.sub) - 200) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.it);
}
