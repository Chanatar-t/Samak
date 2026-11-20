import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";

// ponytail: single-user app. Every row is owned by OWNER; a users table only if this ever goes multi-user.
// ALLOWED_EMAIL keeps existing data (rows were keyed by the Google login email) and doubles as the Google whitelist.
export const OWNER = process.env.ALLOWED_EMAIL || "owner";

export const googleEnabled = !!process.env.AUTH_GOOGLE_ID;

const sha = (s: string) => createHash("sha256").update(s).digest();
/** Constant-time compare; false when APP_PASSWORD isn't set so an empty password never logs in. */
export function checkPassword(given: unknown, expected = process.env.APP_PASSWORD) {
  return !!expected && typeof given === "string" && timingSafeEqual(sha(given), sha(expected));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  providers: [
    // ponytail: no rate limit on attempts; fine on localhost, put it behind a strong password or Google login if exposed
    Credentials({
      credentials: { password: {} },
      authorize: ({ password }) => (checkPassword(password) ? { id: OWNER, email: OWNER, name: "owner" } : null),
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    signIn: ({ user, account }) => account?.provider === "credentials" || (!!user.email && user.email === process.env.ALLOWED_EMAIL),
  },
});

export async function requireUser() {
  if (!(await auth())?.user) redirect("/login");
  return OWNER;
}
