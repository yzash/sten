import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, tokenFor } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/signals");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/signals";
  const expected = process.env.DEMO_PASSWORD;
  const base = new URL(req.url);
  if (!expected) return NextResponse.redirect(new URL("/login?error=config", base), 303);
  if (password !== expected) return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(safeNext)}`, base), 303);
  const res = NextResponse.redirect(new URL(safeNext, base), 303);
  res.cookies.set(AUTH_COOKIE, await tokenFor(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE,
    path: "/",
  });
  return res;
}
