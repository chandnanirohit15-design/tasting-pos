"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useI18n } from "./i18n";

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
  const { t } = useI18n();

  // Hide sidebar inside kitchen routes (kitchen is separate)
  if (pathname.startsWith("/kitchen")) return null;

  return (
    <aside className="w-56 border-r border-zinc-800 bg-black p-3 shrink-0">
      <div className="text-[11px] uppercase tracking-wider font-black text-zinc-500 px-1 mb-3">
        {t("Navigation", "Navigation")}
      </div>

      <div className="space-y-2">
        {ITEMS.map((i) => (
          <NavButton key={i.href} label={t(i.label, i.label)} href={i.href} active={pathname === i.href} />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="text-[11px] uppercase tracking-wider font-black text-zinc-500 px-1 mb-2">
          {t("Kitchen", "Kitchen")}
        </div>

        <Link
          href="/kitchen/login"
          className="w-full inline-block px-3 py-2 rounded-lg text-sm font-bold border transition bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900"
        >
          {t("Kitchen Login", "Kitchen Login")}
        </Link>
      </div>
    </aside>
  );
}
