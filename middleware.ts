import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, gateDisabled, tokenFor } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const res = await gate(req);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

async function gate(req: NextRequest) {
  if (gateDisabled()) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/login")) return NextResponse.next();
  const pw = process.env.DEMO_PASSWORD;
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (pw && cookie && cookie === (await tokenFor(pw))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
