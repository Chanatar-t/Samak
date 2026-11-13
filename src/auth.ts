import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { redirect } from "next/navigation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn: ({ user }) => !!user.email && user.email === process.env.ALLOWED_EMAIL,
  },
});

export async function requireUser() {
  const email = (await auth())?.user?.email;
  if (!email || email !== process.env.ALLOWED_EMAIL) redirect("/api/auth/signin");
  return email;
}
