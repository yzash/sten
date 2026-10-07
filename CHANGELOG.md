# Changelog

- Scaffold: Next.js 15, TypeScript, Tailwind 4, zod, Zustand, vitest, Playwright; design tokens; password gate and noindex.
- Schemas and seed: zod schemas for every entity (PRD 6); `scripts/seed.ts` with fixed seed produces 42 suppliers, 180 parts, 95 POs / 310 lines, 36 work orders, 58 shipments, 180 inventory rows, 40 signals, 12 precedents.
- Deterministic layer: materiality filter, layered impact chain, impact scoring bands, risk scorecard composite, split PO maths; vitest with the Aerotech fixture (78 / 64 / 55 / 70).
