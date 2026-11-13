import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { LogOut } from "lucide-react";
import { signOut } from "@/auth";
import Nav from "./nav";
import "./globals.css";

const font = IBM_Plex_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600"], variable: "--font-thai" });

export const metadata: Metadata = { title: "Job Tracker" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/40">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
            <span className="font-semibold tracking-tight">Job Tracker</span>
            <div className="ml-auto flex items-center gap-2">
              <Nav />
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                <button title="ออกจากระบบ" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
