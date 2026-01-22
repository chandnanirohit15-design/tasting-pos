"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

type Item = { label: string; href: string };

const ITEMS: Item[] = [
  { label: "Reservations", href: "/reservations" },
  { label: "Room", href: "/room" },
  { label: "Dashboard", href: "/dashboard" },
];

function NavButton({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "w-full px-3 py-2 rounded-lg text-sm font-bold border transition block",
        active
          ? "bg-amber-500 text-black border-amber-400"
          : "bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar inside kitchen routes (kitchen is separate)
  if (pathname.startsWith("/kitchen")) return null;

  return (
    <aside className="w-56 border-r border-zinc-800 bg-black p-3 shrink-0">
      <div className="text-[11px] uppercase tracking-wider font-black text-zinc-500 px-1 mb-3">
        Navigation
      </div>

      <div className="space-y-2">
        {ITEMS.map((i) => (
          <NavButton key={i.href} label={i.label} href={i.href} active={pathname === i.href} />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="text-[11px] uppercase tracking-wider font-black text-zinc-500 px-1 mb-2">
          Kitchen
        </div>

        <Link
          href="/kitchen/login"
          className="w-full inline-block px-3 py-2 rounded-lg text-sm font-bold border transition bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900"
        >
          Kitchen Login
        </Link>
      </div>
    </aside>
  );
}
