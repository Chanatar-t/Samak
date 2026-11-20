"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Inbox, ListChecks, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "ใบสมัคร", icon: ListChecks },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "สรุปผล", icon: BarChart3 },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

export default function Nav({ inbox }: { inbox: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/a/") : path.startsWith(href));
  return (
    <nav className="ml-auto flex items-center gap-1 lg:ml-0 lg:flex-col lg:items-stretch">
      <Link
        href="/add"
        className="order-last ml-1 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 lg:order-first lg:mb-4 lg:ml-0 lg:justify-center lg:py-2"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">เพิ่มใบสมัคร</span>
      </Link>
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:py-2",
            active(href) && "bg-muted font-medium text-foreground",
          )}
        >
          <Icon className="size-4" />
          <span className="hidden sm:inline">{label}</span>
          {href === "/inbox" && inbox > 0 && (
            <span className="absolute -top-1 -right-1 rounded-full bg-highlight px-1.5 text-[10px] font-semibold text-highlight-foreground tabular-nums lg:static lg:ml-auto lg:text-xs">
              {inbox}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
