"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Inbox, KanbanSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Board", icon: KanbanSquare },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            path === href && "bg-muted text-foreground",
          )}
        >
          <Icon className="size-4" />
          <span className="hidden sm:inline">{label}</span>
        </Link>
      ))}
      <Link
        href="/add"
        className="ml-1 flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">เพิ่มใบสมัคร</span>
      </Link>
    </nav>
  );
}
