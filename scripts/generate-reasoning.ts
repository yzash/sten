/**
 * Build-time reasoning generator (PRD 7.2). Never runs at request time.
 *   pnpm gen:reasoning                  all material signals (feed + library)
 *   pnpm gen:reasoning --signal SIG-0007
 *   pnpm gen:reasoning --dump-inputs    write inputs only, no API call (for offline review)
 * Requires ANTHROPIC_API_KEY locally. Outputs are committed so Vercel builds need no key.
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { assess, listLibrarySignals, listPrecedents, listSignals } from "../lib/api";
import { buildReasoningInput } from "../lib/reasoning-input";
import { buildUserPrompt, checkReasoning, PROMPT_VERSION, SYSTEM_PROMPT } from "../lib/reasoning-contract";

const MODEL = process.env.REASONING_MODEL ?? "claude-sonnet-4-6";
const OUT = path.join(__dirname, "..", "data", "reasoning");
const INPUTS = path.join(__dirname, "..", "data", "reasoning-inputs");

const args = process.argv.slice(2);
const only = args.includes("--signal") ? args[args.indexOf("--signal") + 1] : null;
const dumpOnly = args.includes("--dump-inputs");

const targets = [...listSignals(), ...listLibrarySignals()].filter((s) => s.material && (!only || s.id === only));
if (targets.length === 0) throw new Error(only ? `No material signal ${only}` : "No material signals");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (dumpOnly) {
    fs.mkdirSync(INPUTS, { recursive: true });
    for (const s of targets) fs.writeFileSync(path.join(INPUTS, `${s.id}.json`), JSON.stringify(buildReasoningInput(s), null, 2));
    console.log(`Wrote ${targets.length} inputs to ${INPUTS}`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (local only, never on Vercel)");
  const client = new Anthropic();
  const precedentIds = new Set(listPrecedents().map((p) => p.id));

  for (const s of targets) {
    const input = buildReasoningInput(s);
    let lastIssues: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              buildUserPrompt(input) +
              (lastIssues.length ? `\n\nYour previous answer failed validation:\n- ${lastIssues.join("\n- ")}\nFix these and return the full JSON again.` : ""),
          },
        ],
      });
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      json.signal_id = s.id;
      json.generated = { by: `anthropic-api:${MODEL}`, at: new Date().toISOString(), prompt_version: PROMPT_VERSION };
      const issues = checkReasoning(json, assess(s), precedentIds);
      if (issues.length === 0) {
        fs.writeFileSync(path.join(OUT, `${s.id}.json`), JSON.stringify(json, null, 2) + "\n");
        console.log(`${s.id} ok (attempt ${attempt})`);
        lastIssues = [];
        break;
      }
      lastIssues = issues.map((i) => `${i.path}: ${i.message}`);
      console.warn(`${s.id} attempt ${attempt} failed:\n  ${lastIssues.join("\n  ")}`);
    }
    if (lastIssues.length) throw new Error(`${s.id} failed validation after 3 attempts; build stopped`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
