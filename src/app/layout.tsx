import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = { title: "Job Tracker" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900">
        <nav className="flex gap-4 border-b bg-white px-4 py-3 text-sm font-medium">
          <Link href="/">Board</Link>
          <Link href="/add">+ เพิ่ม</Link>
          <Link href="/dashboard">Dashboard</Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }} className="ml-auto">
            <button className="text-neutral-500 hover:text-neutral-900">ออกจากระบบ</button>
          </form>
        </nav>
        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
