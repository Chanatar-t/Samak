import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { after } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { OWNER, auth, signOut } from "@/auth";
import { db, emails } from "@/db";
import { autoSync } from "@/lib/sync";
import Nav from "./nav";
import "./globals.css";

const font = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-thai" });

export const metadata: Metadata = { title: "Job Tracker" };

async function reviewCount() {
  after(() => autoSync(OWNER)); // new mail shows up on the next page load
  const [r] = await db.select({ n: count() }).from(emails).where(and(eq(emails.userId, OWNER), eq(emails.processState, "needs_review")));
  return r.n;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const signedIn = !!(await auth())?.user;
  const inbox = signedIn ? await reviewCount() : 0;
  return (
    <html lang="th" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full lg:flex">
        {signedIn && (
        <aside className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
          <div className="flex h-14 items-center gap-3 px-4 lg:h-full lg:flex-col lg:items-stretch lg:gap-6 lg:py-6">
            <div className="flex items-center gap-2 font-semibold tracking-tight lg:px-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny static svg, next/image adds nothing */}
              <img src="/icon.svg" alt="" width={28} height={28} />
              Job Tracker
            </div>
            <Nav inbox={inbox} />
            <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }} className="lg:mt-auto">
              <button title="ออกจากระบบ" className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                <LogOut className="size-4" />
                <span className="hidden lg:inline">ออกจากระบบ</span>
              </button>
            </form>
          </div>
        </aside>
        )}
        <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 lg:px-8 lg:py-10">{children}</main>
      </body>
    </html>
  );
}
