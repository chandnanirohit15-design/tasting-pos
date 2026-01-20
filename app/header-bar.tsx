"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useRole } from "./role-store";

type NavItem = {
  label: string;
  href: string;
  roles?: Array<"SERVER" | "KITCHEN">;
};

const NAV: NavItem[] = [
  { label: "Reservations", href: "/reservations" },
  { label: "Room", href: "/room" }, // <-- renamed route (recommended)
  { label: "Kitchen", href: "/kitchen", roles: ["KITCHEN"] },
  { label: "Dashboard", href: "/dashboard" },
];

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "px-3 py-1.5 rounded-md text-xs font-black tracking-wide border transition",
        active
          ? "bg-amber-500 text-black border-amber-400"
          : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function ClientClock() {
  const [time, setTime] = React.useState<string>("");

  React.useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setTime(fmt());
    const id = window.setInterval(() => setTime(fmt()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  // avoid hydration mismatch
  if (!time) return <div className="ml-3 w-12" />;
  return <div className="ml-3 text-xs font-mono text-zinc-400">{time}</div>;
}

export default function HeaderBar() {
  const pathname = usePathname();
  const { role } = useRole(); // we still keep role in state for later permissions

  const visibleNav = NAV.filter((n) => !n.roles || n.roles.includes(role));

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950">
      {/* LEFT */}
      <div className="flex items-center gap-4">
        <div className="text-white font-black tracking-tight">Restaurant OS</div>

        <div className="flex items-center gap-2">
          {visibleNav.map((n) => (
            <Tab key={n.href} href={n.href} label={n.label} active={pathname === n.href} />
          ))}
        </div>
      </div>

      {/* CENTER */}
      <div className="text-xs text-zinc-400 font-medium hidden md:block">
        Service Control Panel
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        <ClientClock />
      </div>
    </header>
  );
}
