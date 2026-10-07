/** Fails when any stored reasoning drifts from the deterministic layer or breaks copy rules. */
import fs from "node:fs";
import path from "node:path";
import { assess, getSignal, listLibrarySignals, listPrecedents, listSignals } from "../lib/api";
import { checkReasoning } from "../lib/reasoning-contract";

const DIR = path.join(__dirname, "..", "data", "reasoning");
const precedentIds = new Set(listPrecedents().map((p) => p.id));
const required = [...listSignals(), ...listLibrarySignals()].filter((s) => s.material).map((s) => s.id);
let failed = 0;
for (const id of required) {
  const file = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(file)) {
    console.error(`${id}: missing reasoning file`);
    failed++;
    continue;
  }
  const issues = checkReasoning(JSON.parse(fs.readFileSync(file, "utf8")), assess(getSignal(id)!), precedentIds);
  if (issues.length) {
    failed++;
    console.error(`${id}:\n  ${issues.map((i) => `${i.path}: ${i.message}`).join("\n  ")}`);
  } else console.log(`${id} ok`);
}
if (failed) {
  console.error(`${failed} reasoning file(s) failed`);
  process.exit(1);
}
