# Changelog

- Scaffold: Next.js 15, TypeScript, Tailwind 4, zod, Zustand, vitest, Playwright; design tokens; password gate and noindex.
- Schemas and seed: zod schemas for every entity (PRD 6); `scripts/seed.ts` with fixed seed produces 42 suppliers, 180 parts, 95 POs / 310 lines, 36 work orders, 58 shipments, 180 inventory rows, 40 signals, 12 precedents.
- Deterministic layer: materiality filter, layered impact chain, impact scoring bands, risk scorecard composite, split PO maths; vitest with the Aerotech fixture (78 / 64 / 55 / 70).
- Reasoning: model-agnostic contract, build-time generator with zod validation, 5% reconciliation and dash lint; 19 prebuilt reasoning files (16 material feed signals, 3 library).
- App shell and Signal Feed: rail, top bar, persona switcher, simulated clock, fuzzy global search, filters, filtered-out group, merged corroborating signals, inject a signal (library and free text).
- Response workspace: classification with override, layered impact chain SVG, four impact scores, ranked options with recommendation, compare, Ask panel with streaming, approve, reject and defer, animated agent execution into the log.
- Risk Scorecard and supplier pages: heatmap with editable weights, critical parts, diversification recommendations that create sourcing tasks, 12-month factor trends.
- Purchasing: open PO board with split candidates, split PO builder through the approval flow, sourcing call recommendations.
- Stubs, Predict, Execution Log, Feedback: one seeded case per stub with Phase 2 banner, static tariff scenario, log and feedback with CSV export.
- QA: Playwright run of the 9-step walkthrough and password gate, 1280 layout, interrupted executions resume after reload, Lighthouse performance 100 on the workspace.
