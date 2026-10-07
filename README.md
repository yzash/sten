# Supplier Resilience MVP

Clickable validation prototype for ST Engineering Commercial Aerospace procurement, on synthetic Aerospace MRO data. Built from the PRD dated 7 Oct 2026 for the 13 Oct business walkthrough and tech discovery session.

Signal in, classified, filtered for material impact, impact scored, options generated, human approves, agent executes into a mock SAP write log.

## Run it

```bash
pnpm install
pnpm dev                 # http://localhost:3000 (gate open locally when DEMO_PASSWORD is unset)
DEMO_PASSWORD=... pnpm build && pnpm start
```

| Command | What it does |
| --- | --- |
| `pnpm seed` | Regenerates `/data/*.json` with a fixed seed. Fails if any PRD invariant breaks (volumes, 16 material / 8 discarded, Aerotech at 78 / 64 / 55 / 70, engine scorecard red / amber mix, blocklist). |
| `pnpm gen:reasoning [--signal SIG-0007]` | Build-time reasoning generator (Anthropic API, `ANTHROPIC_API_KEY` local only). Validates schema, 5% reconciliation and the no-dash rule, retries, fails the build on drift. |
| `pnpm gen:reasoning --dump-inputs` | Writes the exact model inputs to `data/reasoning-inputs/` (git-ignored) without an API call. |
| `pnpm validate:reasoning` | Re-indexes and validates every stored reasoning file against the deterministic layer. |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Quality gates. Vitest covers materiality, impact chain, scoring bands, scorecard, split PO maths, reasoning schema and reconciliation. |
| `pnpm test:e2e` | Playwright: builds, starts with a test password, runs the 9-step walkthrough and the password gate. Set `PW_CHROMIUM` to a local Chromium if Playwright's own is not installed. |

## Where things live

```
app/(app)/            routes behind the shell: signals, signals/[id], scorecard, suppliers/[id],
                      purchasing, shipment, warehouse, relationships (stubs), predict, log, feedback
app/login, api/login  password gate (middleware.ts, 7 day cookie, noindex everywhere)
components/           shell, ui primitives, signals, workspace, scorecard, purchasing, log
lib/api/              every read of a system of record (SAP MM, planning, logistics, signals, sourcing)
lib/materiality.ts    exposure rule (a) supplier, (b) region and category, (c) route corridor
lib/impact-chain.ts   signal → supplier → PO line → requirement → work order → milestone
lib/scoring.ts        impact bands, overall = max, risk scorecard composite and RAG
lib/split-po.ts       split ratio maths
lib/agents/           execute.ts + one mock adapter per system (production contract)
lib/reasoning-contract.ts  model-agnostic system prompt, schema checks, reconciliation
data/                 seeded JSON; data/reasoning/ holds the 19 prebuilt reasoning files
scripts/              seed, generate-reasoning, validate-reasoning, index-reasoning, blocklist
```

No component reads `/data` directly; pages call `lib/api` on the server and pass props. Writes only go through `lib/agents/execute.ts`.

## Demo script (13 Oct, about 25 minutes)

1. **Signals**: 14 signals in 72 hours, 4 material, 7 merged as corroborating, 3 filtered out. Open the filtered group to show the Red Sea notice and its reason.
2. **SIG-0007 Aerotech receivership**: supplier distress, operational, 0.91, credit alert 89 minutes before SAP's posting block.
3. **Impact**: cost 78 (USD 2.26M: 1.40M PO, 420K expedite, 440K LD), delay 64 (WO-2601 redelivery +15d), ops 55 (2 lines, slot E-17), reputation 70 (Tanjong Pacific, USD 12K per day). Expand the chain.
4. **Options**: five, OPT-1 recommended (70/30 Meridian and broker stock, USD 222K). Use Ask and Compare.
5. **Approve OPT-1**: four agent actions animate to confirmed with SAP document numbers. Open Execution Log.
6. **Risk Scorecard** as Rajiv Menon: Aerotech red, Kemuning and Hokushin amber. Approve DIV-01, a sourcing task is created.
7. **Precedents**: PRE-03 from the workspace, the 2023 forging insolvency. PRE-05 is the 2024 nickel allocation (open SIG-0002).
8. **Stubs**: Shipment (FRA to SIN reroute), Warehouse (seal batch, reallocate and hold GR), Relationships (Arden early payment).
9. **Predict**: tariff extension on EU nacelle parts.

Dev drawer (click the sim clock): rewind 72 hours and step forward to replay signals; reset demo. Flag this on any screen captures notes, exported from Feedback as CSV.

## Decisions and assumptions

- **Signal counts.** The PRD asks for 40 signals with 16 material and 8 discarded. The other 16 are modelled as corroborating duplicates merged into a material parent (dedup before the filter). They show as evidence on the parent and in the feed's merged count.
- **LD exposure** is taken at the unmitigated slip (days the part is late against the contracted slot), while delay is slip beyond float. That is what makes Aerotech land exactly at reputation 70 with the USD 12K per day clause.
- **Reasoning** was authored offline against the same prompt and schema (no API key in the build environment) and passes the same validator the generator enforces. Running `pnpm gen:reasoning` with a key regenerates it via the API.
- **Library signals**: 6 prewritten, 3 material with prebuilt reasoning and 3 that the filter discards. Free-text injection runs the rules-based classifier (confidence 0.60, draft badge) and the real materiality and scoring; options need the reasoning service.
- **Reload during execution** resumes queued actions rather than leaving them stuck.
- **Dependencies beyond PRD section 8**: `tsx` (runs the TypeScript scripts), `lucide-react` and `clsx` (shadcn defaults), `@anthropic-ai/sdk` (generator only, dev dependency). shadcn-style primitives are written in `components/ui` rather than generated, to keep default styling out.

## Lighthouse

`/signals/SIG-0007`, desktop preset, production build: performance 100, accessibility 93, best practices 100.
