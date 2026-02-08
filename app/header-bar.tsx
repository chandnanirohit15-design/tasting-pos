"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { useRole } from "./role-store";
import { useAppState } from "./app-state";
import { useI18n } from "./i18n";

type NavKey = "reservations" | "dashboard" | "room" | "kitchen";

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-md text-xs font-black tracking-wide border transition",
        active
          ? "bg-amber-500 text-black border-amber-400"
          : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function DrawerLink({
  href,
  title,
  subtitle,
  onClick,
}: {
  href: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900/60 p-4 transition"
    >
      <div className="text-white font-black text-sm">{title}</div>
      {subtitle ? <div className="text-xs text-zinc-500 mt-1">{subtitle}</div> : null}
    </Link>
  );
}

export default function HeaderBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, setRole, kitchenAuthed } = useRole();
  const { lanStatus, lanMode } = useAppState();
  const { t } = useI18n();

  const [mounted, setMounted] = React.useState(false);
  const [clock, setClock] = React.useState("—");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    const tick = () => {
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const activeKey: NavKey = React.useMemo(() => {
    if (pathname.startsWith("/reservations")) return "reservations";
    if (pathname.startsWith("/dashboard")) return "dashboard";
    if (pathname.startsWith("/room")) return "room";
    if (pathname.startsWith("/kitchen")) return "kitchen";
    return "dashboard";
  }, [pathname]);

  const go = React.useCallback(
    (key: NavKey) => {
      if (key === "kitchen") {
        setRole("KITCHEN");
        router.push(kitchenAuthed ? "/kitchen" : "/kitchen/login");
        return;
      }
      if (key === "room") {
        setRole("ROOM");
        router.push("/room");
        return;
      }
      router.push(key === "reservations" ? "/reservations" : "/dashboard");
    },
    [router, setRole, kitchenAuthed]
  );

  const lanText =
    lanMode === "OFF"
      ? t("LAN OFF", "LAN OFF")
      : lanStatus === "CONNECTED"
      ? lanMode === "HOST"
        ? t("LAN HOST", "LAN HOST")
        : t("LAN OK", "LAN OK")
      : lanStatus === "CONNECTING"
      ? t("LAN CONNECTING", "LAN CONNECTING")
      : t("LAN DISCONNECTED", "LAN DISCONNECTED");

  const lanTone =
    lanMode === "OFF"
      ? "border-zinc-800 bg-black/40 text-zinc-400"
      : lanStatus === "CONNECTED"
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
      : lanStatus === "CONNECTING"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
      : "border-red-700/60 bg-red-900/20 text-red-200";

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950">
        {/* LEFT */}
        <div className="flex items-center gap-3">
          {/* Menu button */}
          <button
            onClick={() => setOpen(true)}
            className="h-9 w-9 rounded-md border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-200 flex items-center justify-center"
            aria-label={t("Open", "Open")}
          >
            ☰
          </button>

          <div className="text-white font-black tracking-tight">Restaurant OS</div>

          <div className="flex items-center gap-2">
            <Tab label={t("Reservations", "Reservations")} active={activeKey === "reservations"} onClick={() => go("reservations")} />
            <Tab label={t("Dashboard", "Dashboard")} active={activeKey === "dashboard"} onClick={() => go("dashboard")} />
            <Tab label={t("Room", "Room")} active={activeKey === "room"} onClick={() => go("room")} />
            <Tab label={t("Kitchen", "Kitchen")} active={activeKey === "kitchen"} onClick={() => go("kitchen")} />
          </div>
        </div>

        {/* CENTER */}
        <div className="text-xs text-zinc-400 font-medium hidden md:block">
          {role === "KITCHEN" ? t("Kitchen", "Kitchen") : t("Room", "Room")} • {t("Service Control Panel", "Service Control Panel")}
        </div>

        {/* RIGHT */}
       {/* RIGHT */}
<div className="flex items-center gap-3">
  <button onClick={() => router.push("/device")} className="focus:outline-none">
    <div className={`px-3 py-1.5 rounded-xl border text-[10px] font-black ${lanTone}`}>{lanText}</div>
  </button>
  <div className="text-xs font-mono text-zinc-400 tabular-nums">{mounted ? clock : "—"}</div>
</div>

      </header>

      {/* Drawer */}
      {open ? (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />

          {/* panel */}
          <div className="absolute left-0 top-0 h-full w-[360px] border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-white font-black">{t("Menu", "Menu")}</div>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-md text-xs font-black border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              >
                {t("Close", "Close")}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <DrawerLink
                href="/settings"
                title={t("Settings", "Settings")}
                subtitle={t("General configuration", "General configuration")}
                onClick={() => setOpen(false)}
              />
              <DrawerLink
                href="/device"
                title={t("Device Setup", "Device Setup")}
                subtitle={t("Role + pairing code", "Role + pairing code")}
                onClick={() => setOpen(false)}
              />
              <DrawerLink
                href="/settings/accounts"
                title={t("Accounts", "Accounts")}
                subtitle={t("Add staff accounts (UI placeholder)", "Add staff accounts (UI placeholder)")}
                onClick={() => setOpen(false)}
              />
              <DrawerLink
                href="/settings/account"
                title={t("My Account", "My Account")}
                subtitle={t("Your profile & device info (UI placeholder)", "Your profile & device info (UI placeholder)")}
                onClick={() => setOpen(false)}
              />
            </div>

            <div className="mt-6 text-[11px] text-zinc-500">
              {t("UI-first build. Database/security later.", "UI-first build. Database/security later.")}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
