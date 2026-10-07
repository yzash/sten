export const AUTH_COOKIE = "ste_demo_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Cookie value is a SHA-256 of the password plus a fixed salt, so the password never sits in the cookie. */
export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`ste-sr:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Gate is open only in local development when no password is configured. */
export function gateDisabled(): boolean {
  return !process.env.DEMO_PASSWORD && process.env.NODE_ENV !== "production";
}
