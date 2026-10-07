import Papa from "papaparse";

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v]))));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
