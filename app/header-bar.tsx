"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { useRole } from "./role-store";

type Role = "ROOM" | "KITCHEN";
type NavItem = { label: string; href: string; roles?: Role[] };

const NAV: NavItem[] = [
  { label: "Reservations", href: "/reservations", roles: ["ROOM"] },
  { label: "Room", href: "/room", roles: ["ROOM"] },
  { label: "Dashboard", href: "/dashboard", roles: ["ROOM"] },
  { label: "Kitchen", href: "/kitchen", roles: ["KITCHEN"] },
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

export default function HeaderBar() {
  // ✅ ALL hooks at top-level, always called in same order
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, kitchenAuthed } = useRole();

  const [mounted, setMounted] = React.useState(false);
  const [clock, setClock] = React.useState("—");

  React.useEffect(() => {
    setMounted(true);

    const tick = () => {
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const visibleNav = React.useMemo(() => {
    return NAV.filter((n) => !n.roles || n.roles.includes(role));
  }, [role]);

  const goRoom = () => {
    setRole("ROOM");
    router.push("/room");
  };

  const goKitchen = () => {
    setRole("KITCHEN");
    router.push(kitchenAuthed ? "/kitchen" : "/kitchen/login");
  };

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
      <div className="text-xs text-zinc-400 font-medium hidden md:block">Service Control Panel</div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">
        <button
          onClick={goRoom}
          className={[
            "px-3 py-1.5 rounded-md text-xs font-black border transition",
            role === "ROOM"
              ? "bg-amber-500 text-black border-amber-400"
              : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
          ].join(" ")}
        >
          ROOM
        </button>

        <button
          onClick={goKitchen}
          className={[
            "px-3 py-1.5 rounded-md text-xs font-black border transition",
            role === "KITCHEN"
              ? "bg-amber-500 text-black border-amber-400"
              : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
          ].join(" ")}
        >
          KITCHEN
        </button>

        {/* ✅ hydration safe: show clock only after mount */}
        <div className="ml-3 text-xs font-mono text-zinc-400 tabular-nums">
          {mounted ? clock : "—"}
        </div>
      </div>
    </header>
  );
}
