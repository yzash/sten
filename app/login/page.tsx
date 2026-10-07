import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <form method="post" action="/api/login" className="w-[380px] border border-rule-2 bg-paper">
        <div className="border-b border-rule px-6 py-5">
          <div className="label mb-2">Commercial Aerospace · Prototype, synthetic data</div>
          <h1 className="text-[22px] font-medium tracking-[-0.02em]">Supplier Resilience</h1>
          <p className="accent-line mt-1 text-[14.5px] text-ink-2">Signal in, impact scored, human approves, agent executes.</p>
        </div>
        <div className="space-y-3 px-6 py-5">
          <input type="hidden" name="next" value={next ?? "/signals"} />
          <label className="block">
            <span className="label mb-1.5 block">Demo password</span>
            <input
              name="password"
              type="password"
              autoFocus
              required
              className="h-9 w-full border border-rule-2 bg-paper px-2.5 text-[14px] focus:border-accent focus:outline-none"
            />
          </label>
          {error === "1" && <p className="text-[12.5px] text-sev-critical">That password did not match.</p>}
          {error === "config" && <p className="text-[12.5px] text-sev-critical">DEMO_PASSWORD is not configured on this deployment.</p>}
          <button className="h-9 w-full border border-accent bg-accent text-[13.5px] text-white hover:bg-accent-ink">Enter</button>
        </div>
        <div className="border-t border-rule px-6 py-3 text-[11.5px] text-ink-3">Shared access for the ST Engineering procurement team. Session lasts 7 days.</div>
      </form>
    </div>
  );
}
